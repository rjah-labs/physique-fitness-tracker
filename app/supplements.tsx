"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Supplement={id:string;name:string;brand:string|null;dose_value:number;dose_unit:string;concentration_mg_per_ml:number|null;composition_notes:string|null;scheduled_time:string;scheduled_weekdays:number[];active:boolean;notes:string|null;reminder_enabled:boolean;follow_up_minutes:number|null};
type Log={supplement_id:string;scheduled_on?:string;status:"taken"|"skipped";actual_dose_value?:number|null;actual_dose_unit?:string|null;preset_dose_value?:number|null;preset_dose_unit?:string|null;concentration_mg_per_ml?:number|null;recorded_at?:string|null};
export type SupplementSummary={total:number;recorded:number;next:string|null};
type View="today"|"history"|"schedule";
type HistoryRange=7|30|90|"all";

const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const today=()=>localDate();
const daysAgo=(count:number)=>{const date=new Date();date.setDate(date.getDate()-(count-1));return localDate(date)};
const formatHistoryDate=(value:string)=>new Intl.DateTimeFormat("en-AU",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`));
const days=[{value:1,short:"M",label:"Monday"},{value:2,short:"T",label:"Tuesday"},{value:3,short:"W",label:"Wednesday"},{value:4,short:"T",label:"Thursday"},{value:5,short:"F",label:"Friday"},{value:6,short:"S",label:"Saturday"},{value:0,short:"S",label:"Sunday"}];
const daySummary=(values:number[])=>values.length===7?"Every day":values.length===5&&[1,2,3,4,5].every(day=>values.includes(day))?"Weekdays":days.filter(day=>values.includes(day.value)).map(day=>day.label.slice(0,3)).join(", ");

export async function loadSupplementSummary(userId:string):Promise<SupplementSummary>{
  const [{data:supplements},{data:logs}]=await Promise.all([
    supabase.from("supplements").select("id,name,scheduled_time,scheduled_weekdays").eq("user_id",userId).eq("active",true).order("scheduled_time"),
    supabase.from("supplement_logs").select("supplement_id").eq("user_id",userId).eq("scheduled_on",today())
  ]);
  const todaysItems=(supplements||[]).filter(item=>(item.scheduled_weekdays as number[]).includes(new Date().getDay()));
  const done=new Set((logs||[]).map(log=>log.supplement_id));
  const next=todaysItems.find(item=>!done.has(item.id));
  return {total:todaysItems.length,recorded:todaysItems.filter(item=>done.has(item.id)).length,next:next?`${next.name} · ${String(next.scheduled_time).slice(0,5)}`:null};
}

export function SupplementsArea({userId,advanced,onSummary,onNotice}:{userId:string;advanced:boolean;onSummary:(summary:SupplementSummary)=>void;onNotice:(message:string)=>void}){
  const [items,setItems]=useState<Supplement[]>([]),[logs,setLogs]=useState<Log[]>([]),[weekLogs,setWeekLogs]=useState<Log[]>([]);
  const [historyLogs,setHistoryLogs]=useState<Log[]>([]),[historyRange,setHistoryRange]=useState<HistoryRange>(30),[historySupplement,setHistorySupplement]=useState("all"),[historyLoading,setHistoryLoading]=useState(false);
  const [view,setView]=useState<View>("today"),[editing,setEditing]=useState<Supplement|"new"|null>(null),[dosing,setDosing]=useState<Supplement|null>(null),[busy,setBusy]=useState(false);

  async function load(){
    const [{data:supplements,error},{data:records},{data:history}]=await Promise.all([
      supabase.from("supplements").select("id,name,brand,dose_value,dose_unit,concentration_mg_per_ml,composition_notes,scheduled_time,scheduled_weekdays,active,notes,reminder_enabled,follow_up_minutes").eq("user_id",userId).order("scheduled_time"),
      supabase.from("supplement_logs").select("supplement_id,status,actual_dose_value,actual_dose_unit,preset_dose_value,preset_dose_unit,concentration_mg_per_ml,recorded_at").eq("user_id",userId).eq("scheduled_on",today()),
      supabase.from("supplement_logs").select("supplement_id,status,scheduled_on,actual_dose_value,actual_dose_unit,preset_dose_value,preset_dose_unit,recorded_at").eq("user_id",userId).gte("scheduled_on",daysAgo(7))
    ]);
    if(error){onNotice(error.message);return}
    setItems((supplements||[]) as Supplement[]);setLogs((records||[]) as Log[]);setWeekLogs((history||[]) as Log[]);onSummary(await loadSupplementSummary(userId));
  }

  async function loadHistory(range:HistoryRange){
    setHistoryLoading(true);
    let query=supabase.from("supplement_logs").select("supplement_id,status,scheduled_on,actual_dose_value,actual_dose_unit,preset_dose_value,preset_dose_unit,concentration_mg_per_ml,recorded_at").eq("user_id",userId).order("scheduled_on",{ascending:false}).order("recorded_at",{ascending:false}).limit(500);
    if(range!=="all")query=query.gte("scheduled_on",daysAgo(range));
    const {data,error}=await query;
    setHistoryLoading(false);
    if(error){onNotice(error.message);return}
    setHistoryLogs((data||[]) as Log[]);
  }

  useEffect(()=>{load()},[userId]);
  useEffect(()=>{if(view==="history")loadHistory(historyRange)},[view,historyRange,userId]);

  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);const form=new FormData(event.currentTarget);const unit=String(form.get("unit"));const existing=editing!=="new"?editing:null;
    const values={user_id:userId,name:String(form.get("name")),brand:String(form.get("brand")||"")||null,dose_value:Number(form.get("dose")),dose_unit:unit,concentration_mg_per_ml:advanced?(unit==="ml"&&form.get("concentration")?Number(form.get("concentration")):null):existing?.concentration_mg_per_ml??null,composition_notes:advanced?String(form.get("composition")||"")||null:existing?.composition_notes??null,scheduled_time:String(form.get("time")),scheduled_weekdays:form.getAll("weekdays").map(Number),notes:String(form.get("notes")||"")||null,reminder_enabled:form.get("reminder")==="on",follow_up_minutes:form.get("followUp")?Number(form.get("followUp")):null,updated_at:new Date().toISOString()};
    const result=editing!=="new"&&editing?await supabase.from("supplements").update(values).eq("id",editing.id).eq("user_id",userId):await supabase.from("supplements").insert(values);
    setBusy(false);if(result.error){onNotice(result.error.message);return}const created=editing==="new";setEditing(null);onNotice(created?"Supplement schedule securely saved":"Supplement schedule updated");load();
  }

  async function record(item:Supplement,status:Log["status"],actualDose=item.dose_value){
    const existing=logs.find(log=>log.supplement_id===item.id);const actual={status,actual_dose_value:status==="taken"?actualDose:null,actual_dose_unit:status==="taken"?item.dose_unit:null,recorded_at:new Date().toISOString()};const snapshot={preset_dose_value:item.dose_value,preset_dose_unit:item.dose_unit,concentration_mg_per_ml:item.concentration_mg_per_ml,composition_snapshot:item.composition_notes};
    const result=existing?await supabase.from("supplement_logs").update(actual).eq("user_id",userId).eq("supplement_id",item.id).eq("scheduled_on",today()):await supabase.from("supplement_logs").insert({user_id:userId,supplement_id:item.id,scheduled_on:today(),...actual,...snapshot});
    if(result.error)onNotice(result.error.message);else{setDosing(null);onNotice(status==="taken"?`${item.name} · ${actualDose} ${item.dose_unit} recorded`:`${item.name} marked skipped`);load();if(view==="history")loadHistory(historyRange)}
  }

  async function toggle(item:Supplement){const {error}=await supabase.from("supplements").update({active:!item.active,updated_at:new Date().toISOString()}).eq("id",item.id).eq("user_id",userId);if(error)onNotice(error.message);else load()}

  const active=items.filter(item=>item.active),dueToday=active.filter(item=>item.scheduled_weekdays.includes(new Date().getDay())),recorded=dueToday.filter(item=>logs.some(log=>log.supplement_id===item.id)).length;
  const expected=Array.from({length:7},(_,offset)=>{const date=new Date();date.setDate(date.getDate()-offset);return active.filter(item=>item.scheduled_weekdays.includes(date.getDay())).length}).reduce((total,count)=>total+count,0);
  const taken=weekLogs.filter(log=>log.status==="taken"&&active.some(item=>item.id===log.supplement_id)).length,skipped=weekLogs.filter(log=>log.status==="skipped"&&active.some(item=>item.id===log.supplement_id)).length,adherence=expected?Math.round(taken/expected*100):0;
  const filteredHistory=useMemo(()=>historyLogs.filter(log=>historySupplement==="all"||log.supplement_id===historySupplement),[historyLogs,historySupplement]);
  const groupedHistory=useMemo(()=>filteredHistory.reduce<Record<string,Log[]>>((groups,log)=>{const date=log.scheduled_on||"Unknown";(groups[date]??=[]).push(log);return groups},{}),[filteredHistory]);

  return <div className="content-stack supps-area">
    <section className="section-head"><div><p className="eyebrow">PERSONAL RECORDS · V0.15</p><h1>Supplements.</h1></div>{view!=="history"&&<button className="primary" onClick={()=>setEditing("new")}>＋ Add</button>}</section>
    <div className="supp-tabs" role="tablist" aria-label="Supplement views"><button className={view==="today"?"selected":""} onClick={()=>setView("today")}>Today</button><button className={view==="history"?"selected":""} onClick={()=>setView("history")}>History</button><button className={view==="schedule"?"selected":""} onClick={()=>setView("schedule")}>Schedule</button></div>

    {view==="today"&&<>
      <section className="supp-summary"><div><strong>{recorded}</strong><span>of {dueToday.length}</span></div><p>scheduled today</p></section>
      {active.length>0&&<section className="supp-adherence"><div><p className="eyebrow">LAST 7 DAYS</p><strong>{adherence}%</strong><span>taken as scheduled</span></div><p><b>{taken}</b> taken · <b>{skipped}</b> skipped · <b>{Math.max(0,expected-taken-skipped)}</b> unrecorded</p><small>Unrecorded means no Taken or Skip choice was saved. It is not a medical assessment.</small></section>}
      <div className="medical-boundary"><strong>Logging only</strong><p>Physique records the details you enter. It does not recommend products or dosages and does not provide medical advice.</p></div>
      {items.length===0?<section className="empty-training"><span>◉</span><h2>Your list is empty.</h2><p>Add supplements you already use to create a personal schedule.</p></section>:<section className="supp-stack">{dueToday.map(item=>{const log=logs.find(entry=>entry.supplement_id===item.id);return <SupplementCard key={item.id} item={item} log={log} advanced={advanced} onEdit={()=>setEditing(item)} onToggle={()=>toggle(item)} onSkip={()=>record(item,"skipped")} onDose={()=>setDosing(item)} onTaken={()=>record(item,"taken")}/>})}{dueToday.length===0&&<section className="empty-training compact"><span>✓</span><h2>Nothing scheduled today.</h2><p>Your next scheduled supplement will appear here.</p></section>}</section>}
    </>}

    {view==="schedule"&&<><div className="medical-boundary"><strong>Schedule management</strong><p>Pause, resume or edit your current supplement schedule here. Historical records are kept separately.</p></div>{items.length===0?<section className="empty-training"><span>◉</span><h2>Your list is empty.</h2><p>Add supplements you already use to create a personal schedule.</p></section>:<section className="supp-stack">{items.map(item=><SupplementCard key={item.id} item={item} advanced={advanced} onEdit={()=>setEditing(item)} onToggle={()=>toggle(item)}/>)}</section>}</>}

    {view==="history"&&<section className="supp-history"><div className="history-toolbar"><div className="history-ranges">{([7,30,90,"all"] as HistoryRange[]).map(range=><button key={String(range)} className={historyRange===range?"selected":""} onClick={()=>setHistoryRange(range)}>{range==="all"?"All":`${range}d`}</button>)}</div><select aria-label="Filter history by supplement" value={historySupplement} onChange={event=>setHistorySupplement(event.target.value)}><option value="all">All supplements</option>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div><p className="history-protection">History uses the dose snapshot recorded at the time wherever available, so later schedule changes do not rewrite past entries.</p>{historyLoading?<div className="history-empty">Loading history…</div>:Object.keys(groupedHistory).length===0?<div className="history-empty">No supplement records found for this range.</div>:<div className="supp-history-groups">{Object.entries(groupedHistory).sort(([a],[b])=>b.localeCompare(a)).map(([date,entries])=><section key={date} className="supp-history-day"><header><div><p className="eyebrow">{date===today()?"TODAY":"RECORDED"}</p><h2>{formatHistoryDate(date)}</h2></div><span>{entries.length} {entries.length===1?"entry":"entries"}</span></header><div>{entries.map((log,index)=>{const item=items.find(candidate=>candidate.id===log.supplement_id);const dose=log.actual_dose_value??log.preset_dose_value;const unit=log.actual_dose_unit??log.preset_dose_unit??item?.dose_unit;const time=log.recorded_at?new Intl.DateTimeFormat("en-AU",{hour:"numeric",minute:"2-digit"}).format(new Date(log.recorded_at)):null;return <article className="supp-history-row" key={`${log.supplement_id}-${index}`}><span className={`history-status ${log.status}`}>{log.status==="taken"?"✓":"—"}</span><div><strong>{item?.name||"Supplement"}</strong><small>{log.status==="taken"&&dose!=null?`${dose} ${unit||""}`:"Skipped"}{time?` · ${time}`:""}</small></div><b>{log.status==="taken"?"Taken":"Skipped"}</b></article>})}</div></section>)}</div>}</section>}

    {editing&&<SupplementEditor item={editing==="new"?null:editing} advanced={advanced} busy={busy} onClose={()=>setEditing(null)} onSave={save}/>} {dosing&&<DoseRecorder item={dosing} current={logs.find(log=>log.supplement_id===dosing.id)} busy={busy} onClose={()=>setDosing(null)} onRecord={dose=>record(dosing,"taken",dose)}/>} 
  </div>;
}

function SupplementCard({item,log,advanced,onEdit,onToggle,onSkip,onDose,onTaken}:{item:Supplement;log?:Log;advanced:boolean;onEdit:()=>void;onToggle:()=>void;onSkip?:()=>void;onDose?:()=>void;onTaken?:()=>void}){
  return <article className={`supp-card ${!item.active?"paused":""}`}><header><div className="supp-time">{item.scheduled_time.slice(0,5)}</div><div><h2>{item.name}</h2><p>{item.dose_value} {item.dose_unit}{item.brand?` · ${item.brand}`:""}</p>{advanced&&item.dose_unit==="ml"&&item.concentration_mg_per_ml&&<small className="supp-concentration">{item.concentration_mg_per_ml} mg/ml · {(item.dose_value*item.concentration_mg_per_ml).toFixed(1)} mg total</small>}</div><button onClick={onEdit}>Edit</button></header><div className="supp-reminder-state"><span>{item.reminder_enabled?"◉":"○"}</span><small>{item.reminder_enabled?`Reminder at ${item.scheduled_time.slice(0,5)}${item.follow_up_minutes?` + follow-up after ${item.follow_up_minutes} min`:""}`:"Reminders off for this item"}</small></div><small className="supp-days">{daySummary(item.scheduled_weekdays)}</small>{advanced&&item.composition_notes&&<p className="supp-composition"><b>Composition</b>{item.composition_notes}</p>}{log?.status==="taken"&&<p className="supp-recorded-dose">Recorded today · <b>{log.actual_dose_value??log.preset_dose_value??item.dose_value} {log.actual_dose_unit??log.preset_dose_unit??item.dose_unit}</b>{log.preset_dose_value&&Number(log.actual_dose_value)!==Number(log.preset_dose_value)?` · preset ${log.preset_dose_value} ${log.preset_dose_unit}`:""}</p>}{item.notes&&<p className="supp-notes">{item.notes}</p>}<div className="supp-card-controls"><button onClick={onToggle}>{item.active?"Pause":"Resume"}</button>{item.active&&onSkip&&<button className={log?.status==="skipped"?"selected":""} onClick={onSkip}>Skip</button>}{item.active&&advanced&&onDose&&<button onClick={onDose}>Adjust dose</button>}{item.active&&onTaken&&<button className={log?.status==="taken"?"taken selected":"taken"} onClick={onTaken}>✓ Taken</button>}</div></article>;
}

function SupplementEditor({item,advanced,busy,onClose,onSave}:{item:Supplement|null;advanced:boolean;busy:boolean;onClose:()=>void;onSave:(event:React.FormEvent<HTMLFormElement>)=>void}){
  const [reminder,setReminder]=useState(item?.reminder_enabled??true),[selectedDays,setSelectedDays]=useState<number[]>(item?.scheduled_weekdays??[0,1,2,3,4,5,6]),[unit,setUnit]=useState(item?.dose_unit||"mg");
  return <div className="mini-picker supp-dialog"><form onSubmit={onSave}><header><div><p className="eyebrow">{item?"EDIT PERSONAL RECORD":"NEW PERSONAL RECORD"}</p><h2>{item?"Update supplement":"Add supplement"}</h2></div><button type="button" onClick={onClose}>×</button></header><label>Name<input name="name" maxLength={120} defaultValue={item?.name} required/></label><label>Brand <span>optional</span><input name="brand" maxLength={120} defaultValue={item?.brand||""}/></label><div className="dose-fields"><label>Dose<input name="dose" type="number" min="0.001" step="any" inputMode="decimal" defaultValue={item?.dose_value} required/></label><label>Unit<select name="unit" value={unit} onChange={event=>setUnit(event.target.value)}>{["mg","g","mcg","ml","units","capsule","capsules","tablet","tablets","scoop","scoops"].map(option=><option key={option}>{option}</option>)}</select></label></div>{advanced&&unit==="ml"&&<label>Concentration <span>mg/ml</span><input name="concentration" type="number" min="0.001" step="any" inputMode="decimal" defaultValue={item?.concentration_mg_per_ml??""} placeholder="Optional"/></label>}{advanced&&<label>Composition <span>optional</span><textarea name="composition" rows={3} maxLength={1500} defaultValue={item?.composition_notes||""} placeholder="Record ingredients or formulation details"/></label>}<label>Scheduled time<input name="time" type="time" defaultValue={item?.scheduled_time.slice(0,5)} required/></label><fieldset className="supp-weekdays"><legend>Days taken</legend><div>{days.map(day=><label key={day.value} title={day.label}><input name="weekdays" type="checkbox" value={day.value} checked={selectedDays.includes(day.value)} onChange={event=>setSelectedDays(current=>event.target.checked?[...current,day.value]:current.filter(value=>value!==day.value))}/><span>{day.short}</span></label>)}</div><small>{selectedDays.length?daySummary(selectedDays):"Choose at least one day"}</small></fieldset><label className="supp-reminder-toggle"><span><strong>Remind me</strong><small>Requires separate device notification opt-in</small></span><input name="reminder" type="checkbox" checked={reminder} onChange={event=>setReminder(event.target.checked)}/></label>{reminder&&<label>Follow-up if still unrecorded <span>optional</span><select name="followUp" defaultValue={item?.follow_up_minutes||""}><option value="">No follow-up</option><option value="15">After 15 minutes</option><option value="30">After 30 minutes</option><option value="60">After 1 hour</option><option value="90">After 90 minutes</option><option value="120">After 2 hours</option></select></label>}<label>Personal notes <span>optional</span><textarea name="notes" rows={3} maxLength={1000} defaultValue={item?.notes||""}/></label><button className="primary" disabled={busy||selectedDays.length===0}>{busy?"Saving…":item?"Save changes":"Save personal record"}</button></form></div>;
}

function DoseRecorder({item,current,busy,onClose,onRecord}:{item:Supplement;current?:Log;busy:boolean;onClose:()=>void;onRecord:(dose:number)=>void}){
  const [dose,setDose]=useState(Number(current?.actual_dose_value??item.dose_value));const activeMg=item.dose_unit==="ml"&&item.concentration_mg_per_ml?dose*item.concentration_mg_per_ml:null;
  return <div className="mini-picker dose-dialog"><form onSubmit={event=>{event.preventDefault();onRecord(dose)}}><header><div><p className="eyebrow">ACTUAL DAILY DOSE</p><h2>{item.name}</h2></div><button type="button" onClick={onClose}>×</button></header><div className="preset-dose"><span>PRESET DOSE</span><strong>{item.dose_value} {item.dose_unit}</strong><small>Record a different amount for today without changing the schedule.</small></div><label>Actual dose<input type="number" min="0.001" step="any" inputMode="decimal" value={dose} onChange={event=>setDose(Number(event.target.value))} required/></label>{activeMg!=null&&<p className="dose-conversion">At {item.concentration_mg_per_ml} mg/ml, this records <b>{activeMg.toFixed(1)} mg</b>.</p>}<p className="history-protection">This entry keeps the scheduled dose snapshot so your history remains accurate if the preset changes later.</p><button className="primary" disabled={busy||!dose}>{busy?"Saving…":"Record dose"}</button></form></div>;
}
