export type SupplementFrequency="weekly"|"fortnightly"|"monthly";

export type SupplementSchedule={
  schedule_frequency:SupplementFrequency;
  schedule_anchor_date:string|null;
  scheduled_weekdays:number[];
};

const parseDate=(value:string)=>new Date(`${value}T12:00:00`);
const dateOnly=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;

export function isSupplementDue(item:SupplementSchedule,date:Date){
  if(item.schedule_frequency==="weekly")return item.scheduled_weekdays.includes(date.getDay());
  if(!item.schedule_anchor_date)return false;
  const anchor=parseDate(item.schedule_anchor_date),candidate=parseDate(dateOnly(date));
  if(candidate<anchor)return false;
  if(item.schedule_frequency==="fortnightly")return Math.round((candidate.getTime()-anchor.getTime())/86400000)%14===0;
  const lastDay=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
  return date.getDate()===Math.min(anchor.getDate(),lastDay);
}

export function supplementScheduleSummary(item:SupplementSchedule){
  if(item.schedule_frequency==="fortnightly")return item.schedule_anchor_date?`Every 2 weeks from ${formatScheduleDate(item.schedule_anchor_date)}`:"Every 2 weeks";
  if(item.schedule_frequency==="monthly")return item.schedule_anchor_date?`Monthly on day ${parseDate(item.schedule_anchor_date).getDate()}`:"Every month";
  const labels=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return item.scheduled_weekdays.length===7?"Every day":item.scheduled_weekdays.length===5&&[1,2,3,4,5].every(day=>item.scheduled_weekdays.includes(day))?"Weekdays":item.scheduled_weekdays.map(day=>labels[day]).join(", ");
}

export const formatScheduleDate=(value:string)=>parseDate(value).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"});
