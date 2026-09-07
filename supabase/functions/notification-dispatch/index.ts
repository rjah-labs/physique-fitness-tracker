import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Preferences = {
  user_id:string; timezone:string; notifications_enabled:boolean;
  measurement_notifications:boolean; photo_notifications:boolean;
  supplement_notifications:boolean; goal_notifications:boolean;
  measurement_interval_days:number|null; photo_interval_days:number|null;
  reminder_weekday:number; quiet_start:string; quiet_end:string;
};

const url=Deno.env.get("SUPABASE_URL")!;
const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const secret=legacy||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;
const admin=createClient(url,secret,{auth:{persistSession:false}});

function localNow(timezone:string){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
function quiet(time:string,start:string,end:string){const s=start.slice(0,5),e=end.slice(0,5);return s<e?time>=s&&time<e:time>=s||time<e}
function addDays(date:string,days:number,weekday:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);d.setUTCDate(d.getUTCDate()+((weekday-d.getUTCDay()+7)%7));return d.toISOString().slice(0,10)}
function minuteMatch(actual:string,scheduled:string){const [ah,am]=actual.split(":").map(Number),[sh,sm]=scheduled.slice(0,5).split(":").map(Number);return ah*60+am===sh*60+sm}

Deno.serve(async(req)=>{
  try {
  const token=req.headers.get("x-cron-token")||"";
  const {data:runtime}=await admin.rpc("notification_runtime_secrets",{p_token:token});
  if(!runtime?.[0])return new Response("Unauthorized",{status:401});
  webpush.setVapidDetails(runtime[0].vapid_subject,runtime[0].vapid_public_key,runtime[0].vapid_private_key);
  const {data:preferences,error}=await admin.from("user_preferences").select("user_id,timezone,notifications_enabled,measurement_notifications,photo_notifications,supplement_notifications,goal_notifications,measurement_interval_days,photo_interval_days,reminder_weekday,quiet_start,quiet_end").eq("notifications_enabled",true);
  if(error)throw error;
  let sent=0,failed=0;
  for(const pref of (preferences||[]) as Preferences[]){
    const local=localNow(pref.timezone);
    if(quiet(local.time,pref.quiet_start,pref.quiet_end))continue;
    const {data:devices}=await admin.from("notification_devices").select("id,push_endpoint,push_p256dh,push_auth").eq("user_id",pref.user_id).eq("permission","granted").not("push_endpoint","is",null);
    if(!devices?.length)continue;
    const messages:Array<{category:string;reference:string;scheduled:string;title:string;body:string;url:string}>=[];
    if(pref.supplement_notifications){
      const {data:supps,error:suppsError}=await admin.from("supplements").select("id,name,dose_value,dose_unit,concentration_mg_per_ml,scheduled_time,scheduled_weekdays,reminder_enabled,follow_up_minutes").eq("user_id",pref.user_id).eq("active",true);
      if(suppsError)throw suppsError;
      const {data:suppLogs,error:suppLogsError}=await admin.from("supplement_logs").select("supplement_id").eq("user_id",pref.user_id).eq("scheduled_on",local.date);
      if(suppLogsError)throw suppLogsError;
      const recorded=new Set((suppLogs||[]).map(log=>log.supplement_id));
      const [lh,lm]=local.time.split(":").map(Number),nowMinutes=lh*60+lm,localWeekday=new Date(`${local.date}T12:00:00Z`).getUTCDay();
      for(const item of supps||[]){
        if(!item.reminder_enabled||recorded.has(item.id)||!item.scheduled_weekdays.includes(localWeekday))continue;
        const [sh,sm]=String(item.scheduled_time).slice(0,5).split(":").map(Number),scheduledMinutes=sh*60+sm;
        const primary=nowMinutes===scheduledMinutes;
        const follow=Boolean(item.follow_up_minutes)&&nowMinutes===(scheduledMinutes+Number(item.follow_up_minutes))%1440;
        const concentration=item.dose_unit==="ml"&&item.concentration_mg_per_ml?` · ${item.concentration_mg_per_ml} mg/ml`:"";
        if(primary||follow)messages.push({category:"supplement",reference:`${item.id}:${local.date}:${follow?"follow":"due"}`,scheduled:`${local.date}T${local.time}:00Z`,title:follow?"Supplement follow-up":"Supplement reminder",body:follow?`${item.name} is still unrecorded. Preset ${item.dose_value} ${item.dose_unit}.`:`${item.name} · preset ${item.dose_value} ${item.dose_unit}${concentration}`,url:"./?tab=Supps"});
      }
    }
    if(pref.goal_notifications&&local.time==="09:00"){
      const {data:goals}=await admin.from("goals").select("id,label,target_date").eq("user_id",pref.user_id).eq("status","active").eq("target_date",local.date);
      for(const goal of goals||[])messages.push({category:"goal",reference:goal.id,scheduled:`${local.date}T09:00:00Z`,title:"Goal date reached",body:`Review your ${goal.label} goal in Physique.`,url:"./?tab=Goals"});
    }
    if(local.time==="09:00"){
      const {data:checks}=await admin.from("body_check_ins").select("measured_on,progress_photos(id)").eq("user_id",pref.user_id).order("measured_on",{ascending:false}).limit(50);
      const latest=checks?.[0]?.measured_on;const latestPhoto=checks?.find((c:any)=>c.progress_photos?.length)?.measured_on;
      if(pref.measurement_notifications&&pref.measurement_interval_days&&latest){const due=addDays(latest,pref.measurement_interval_days,pref.reminder_weekday);if(local.date>=due)messages.push({category:"measurement",reference:due,scheduled:`${due}T09:00:00Z`,title:"Measurement check-in",body:"Your scheduled measurement check-in is due.",url:"./?tab=Measure"})}
      if(pref.photo_notifications&&pref.photo_interval_days){const due=latestPhoto?addDays(latestPhoto,pref.photo_interval_days,pref.reminder_weekday):local.date;if(local.date>=due)messages.push({category:"photo",reference:due,scheduled:`${due}T09:00:00Z`,title:"Progress photo check-in",body:"Your scheduled progress photo check-in is due.",url:"./?tab=Measure"})}
    }
    for(const message of messages)for(const device of devices){
      const delivery={user_id:pref.user_id,device_id:device.id,category:message.category,reference_key:message.reference,scheduled_for:message.scheduled};
      const {data:row,error:insertError}=await admin.from("notification_deliveries").insert(delivery).select("id").maybeSingle();
      if(insertError?.code==="23505")continue;if(insertError||!row){failed++;continue}
      try{await webpush.sendNotification({endpoint:device.push_endpoint,keys:{p256dh:device.push_p256dh,auth:device.push_auth}},JSON.stringify({title:message.title,body:message.body,url:message.url,tag:`physique-${message.category}-${message.reference}`}));await admin.from("notification_deliveries").update({delivered_at:new Date().toISOString()}).eq("id",row.id);sent++}
      catch(error){await admin.from("notification_deliveries").update({failed_at:new Date().toISOString(),error_message:String(error).slice(0,500)}).eq("id",row.id);failed++;if((error as any)?.statusCode===404||(error as any)?.statusCode===410)await admin.from("notification_devices").update({permission:"default",push_endpoint:null,push_p256dh:null,push_auth:null}).eq("id",device.id)}
    }
  }
  return Response.json({ok:true,sent,failed,checked:preferences?.length||0});
  } catch(error) {
    console.error("notification-dispatch failed",error);
    return Response.json({ok:false,error:error instanceof Error?error.message:JSON.stringify(error)},{status:500});
  }

});
