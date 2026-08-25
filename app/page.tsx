"use client";

import { useEffect, useMemo, useState } from "react";
import {
  baselineCheckIn, cloudFitnessRepository, measurementFields,
  type CheckIn, type MeasurementKey, type Measurements, type PhotoAngle,
} from "../lib/fitness-repository";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import { WorkoutArea } from "./workouts";

type Tab = "Today" | "Measure" | "Train" | "Goals";
type MeasureView = "History" | "Compare" | "Photos";
type UserPreferences = {
  measurement_interval_days: number | null;
  photo_interval_days: number | null;
  reminder_weekday: number;
  units: "metric" | "imperial";
};

const defaultPreferences: UserPreferences = {
  measurement_interval_days: 14,
  photo_interval_days: 28,
  reminder_weekday: 1,
  units: "metric",
};

const formatDate = (date: string, long = false) => new Intl.DateTimeFormat("en-AU", long
  ? { day: "numeric", month: "long", year: "numeric" }
  : { day: "numeric", month: "short", year: "numeric" }
).format(new Date(`${date}T12:00:00`));

export default function Home() {
  const [user,setUser]=useState<User|null>(null); const [ready,setReady]=useState(false);
  useEffect(()=>{supabase.auth.getUser().then(({data})=>{setUser(data.user);setReady(true)});const {data}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user||null);setReady(true)});return()=>data.subscription.unsubscribe()},[]);
  if(!ready)return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">P</div><h1>Loading Physique…</h1></section></main>;
  if(!user)return <AuthScreen/>;
  return <FitnessApp user={user}/>;
}

function AuthScreen(){
  const [mode,setMode]=useState<"signin"|"signup">("signin");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage("");const data=new FormData(e.currentTarget);const email=String(data.get("email"));const password=String(data.get("password"));const result=mode==="signin"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.href}});setBusy(false);if(result.error)setMessage(result.error.message);else if(mode==="signup"&&!result.data.session)setMessage("Check your email to confirm your account.")}
  return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">P</div><p className="eyebrow">PHYSIQUE <span className="version">V0.5</span></p><h1>Your progress.<br/>Private and synced.</h1><p>Sign in to access your measurements, workouts and progress photos on any device.</p><form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Password<input name="password" type="password" minLength={6} autoComplete={mode==="signin"?"current-password":"new-password"} required/></label>{message&&<p className="auth-message" role="status">{message}</p>}<button className="primary" disabled={busy}>{busy?"Please wait…":mode==="signin"?"Sign in":"Create account"}</button></form><button className="auth-switch" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setMessage("")}}>{mode==="signin"?"New here? Create an account":"Already have an account? Sign in"}</button></section></main>
}

function FitnessApp({user}:{user:User}) {
  const [tab, setTab] = useState<Tab>("Today");
  const [checkIns, setCheckIns] = useState<CheckIn[]>([baselineCheckIn]);
  const [editing, setEditing] = useState<CheckIn | null | "new">(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const latest = checkIns.at(-1) || baselineCheckIn;

  useEffect(() => {
    cloudFitnessRepository.importLocal(user.id).then(setCheckIns).catch(error=>notify(error.message));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }, []);

  function notify(message:string){setNotice(message);window.setTimeout(()=>setNotice(current=>current===message?"":current),3500)}
  async function refresh(message: string) {
    setCheckIns(await cloudFitnessRepository.list()); setEditing(null); notify(message);
  }
  async function save(entry:CheckIn,photos:Partial<Record<PhotoAngle,File>>={}){try{const sameDay=editing==="new"?checkIns.find(item=>item.date===entry.date):undefined;const savedEntry=sameDay?{...entry,id:sameDay.id,photos:sameDay.photos,createdAt:sameDay.createdAt}:entry;await cloudFitnessRepository.save(savedEntry,user.id);for(const [angle,file] of Object.entries(photos) as Array<[PhotoAngle,File]>)await cloudFitnessRepository.uploadPhoto(savedEntry,user.id,angle,file);const photoCount=Object.keys(photos).length;await refresh(photoCount?`Check-in and ${photoCount} ${photoCount===1?"photo":"photos"} securely synced`:sameDay?"Check-in for this date updated":editing==="new"?"Check-in securely synced":"Check-in updated")}catch(error){notify(error instanceof Error?error.message:"Unable to save")}}
  async function remove(entry:CheckIn){try{await cloudFitnessRepository.remove(entry);await refresh("Check-in removed")}catch(error){notify(error instanceof Error?error.message:"Unable to delete")}}
  async function uploadFor(entry:CheckIn,angle:PhotoAngle,file?:File){if(!file)return;try{setNotice("Uploading securely…");await cloudFitnessRepository.uploadPhoto(entry,user.id,angle,file);await refresh(`${angle[0].toUpperCase()+angle.slice(1)} photo uploaded`)}catch(error){notify(error instanceof Error?error.message:"Upload failed")}}

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">P</div><div><p className="eyebrow">PHYSIQUE <span className="version">V0.5</span></p><p className="date">{formatDate(latest.date, true)}</p></div><button className="avatar" aria-label="Open account settings" title="Account settings" onClick={()=>setSettingsOpen(true)}>{(user.email||"U").slice(0,2).toUpperCase()}</button></header>
    <section className="hero"><p className="eyebrow">CURRENT WEIGHT</p><div className="weight-row"><strong>{latest.weight}</strong><span>kg</span></div><div className="target-track"><span style={{width:"72%"}}/></div><div className="target-copy"><span>{checkIns.length} {checkIns.length === 1 ? "check-in" : "check-ins"}</span><span>Next target · 100 kg</span></div></section>
    {tab === "Today" && <Dashboard latest={latest} count={checkIns.length} onLog={() => setEditing("new")} onMeasure={() => setTab("Measure")}/>} 
    {tab === "Measure" && <MeasurementsArea entries={checkIns} onAdd={() => setEditing("new")} onEdit={setEditing} onPhotoUpload={uploadFor}/>}
    {tab === "Train" && <WorkoutArea userId={user.id} onNotice={message=>{setNotice(message);window.setTimeout(()=>setNotice(""),2600)}}/>} {tab === "Goals" && <Placeholder kind="goals"/>}
    <nav className="bottom-nav" aria-label="Primary navigation">{(["Today","Measure","Train","Goals"] as Tab[]).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}><span aria-hidden="true">{item === "Today" ? "⌂" : item === "Measure" ? "◇" : item === "Train" ? "＋" : "◎"}</span>{item}</button>)}</nav>
    {editing && <CheckInSheet initial={editing === "new" ? latest : editing} isNew={editing === "new"} userId={user.id} onClose={() => setEditing(null)} onSave={save} onDelete={remove}/>}
    {settingsOpen && <SettingsSheet user={user} onClose={()=>setSettingsOpen(false)} onNotice={notify}/>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </main>;
}

function SettingsSheet({user,onClose,onNotice}:{user:User;onClose:()=>void;onNotice:(message:string)=>void}) {
  const [preferences,setPreferences]=useState<UserPreferences>(defaultPreferences);
  const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
  useEffect(()=>{let active=true;supabase.from("user_preferences").select("measurement_interval_days,photo_interval_days,reminder_weekday,units").eq("user_id",user.id).maybeSingle().then(({data,error})=>{if(!active)return;if(error)onNotice(error.message);if(data)setPreferences(data as UserPreferences);setLoading(false)});return()=>{active=false}},[user.id]);
  function setIntervalPreference(key:"measurement_interval_days"|"photo_interval_days",value:string){setPreferences(current=>({...current,[key]:value==="off"?null:Number(value)}))}
  async function savePreferences(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);const {error}=await supabase.from("user_preferences").upsert({user_id:user.id,...preferences,updated_at:new Date().toISOString()},{onConflict:"user_id"});setSaving(false);if(error){onNotice(error.message);return}onNotice("Settings securely synced");onClose()}
  return <div className="sheet-backdrop settings-backdrop" onClick={onClose}><form className="sheet settings-sheet" onClick={event=>event.stopPropagation()} onSubmit={savePreferences}><div className="sheet-handle"/><div className="sheet-head"><div><p className="eyebrow">YOUR ACCOUNT</p><h2>Settings</h2></div><button type="button" onClick={onClose} aria-label="Close settings">×</button></div><div className="settings-scroll">{loading?<p className="settings-loading">Loading your preferences…</p>:<><section className="account-summary"><div className="avatar large">{(user.email||"U").slice(0,2).toUpperCase()}</div><div><strong>{user.email}</strong><span>Signed in securely</span></div></section><section className="settings-section"><div><p className="eyebrow">CHECK-IN RHYTHM</p><h3>Progress reminders</h3><p>Choose how often Physique should prompt you. Device notifications will be enabled in the next reminder release.</p></div><label>Measurements<select value={preferences.measurement_interval_days??"off"} onChange={event=>setIntervalPreference("measurement_interval_days",event.target.value)}><option value="off">Off</option><option value="7">Every week</option><option value="14">Every 2 weeks</option><option value="30">Every month</option></select></label><label>Progress photos<select value={preferences.photo_interval_days??"off"} onChange={event=>setIntervalPreference("photo_interval_days",event.target.value)}><option value="off">Off</option><option value="14">Every 2 weeks</option><option value="28">Every 4 weeks</option><option value="42">Every 6 weeks</option><option value="56">Every 8 weeks</option></select></label><label>Preferred day<select value={preferences.reminder_weekday} onChange={event=>setPreferences(current=>({...current,reminder_weekday:Number(event.target.value)}))}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day,index)=><option value={index} key={day}>{day}</option>)}</select></label></section><section className="settings-section"><div><p className="eyebrow">DISPLAY</p><h3>Measurement units</h3><p>Your existing records remain unchanged. Imperial display conversion is coming in a later update.</p></div><label>Preferred units<select value={preferences.units} onChange={event=>setPreferences(current=>({...current,units:event.target.value as UserPreferences["units"]}))}><option value="metric">Metric · kg and cm</option><option value="imperial">Imperial · lb and in</option></select></label></section><section className="privacy-card"><span>⌾</span><div><strong>Private by design</strong><p>Your settings, measurements and photos are protected by your Supabase account.</p></div></section></>}</div><div className="settings-actions"><button className="signout-button" type="button" onClick={()=>supabase.auth.signOut()}>Sign out</button><button className="primary" type="submit" disabled={loading||saving}>{saving?"Saving…":"Save settings"}</button></div></form></div>;
}

function Dashboard({latest,count,onLog,onMeasure}:{latest:CheckIn;count:number;onLog:()=>void;onMeasure:()=>void}) {
  const featured: Array<[MeasurementKey,string]> = [["shoulders","lime"],["chest","blue"],["waist","coral"],["hipsGlutes","violet"]];
  return <div className="content-stack"><section className="section-head"><div><p className="eyebrow">LATEST SNAPSHOT</p><h1>Keep building.</h1></div><button className="primary" onClick={onLog}>＋ Check-in</button></section><section className="metric-grid">{featured.map(([key,tone]) => <Metric key={key} value={latest.measurements[key]} label={measurementFields.find(field => field.key === key)!.label} tone={tone}/>)}</section><button className="plan-card" onClick={onMeasure}><div><p className="eyebrow">MEASUREMENT HISTORY</p><h2>{count === 1 ? "Your baseline is ready" : `${count} check-ins recorded`}</h2><p>{count === 1 ? "Add another check-in to unlock comparisons." : "Compare any two dates and see every change."}</p></div><span>→</span></button><section className="insight-card"><p className="eyebrow">PROGRESS PHOTOS</p><h2>Same angles. Honest progress.</h2><p>Front, side and back photo slots are prepared for private Supabase storage.</p></section></div>;
}

function Metric({value,label,tone}:{value:number;label:string;tone:string}) { return <article className={`metric ${tone}`}><div><strong>{value}</strong><span>cm</span></div><p>{label}</p></article>; }

function MeasurementsArea({entries,onAdd,onEdit,onPhotoUpload}:{entries:CheckIn[];onAdd:()=>void;onEdit:(entry:CheckIn)=>void;onPhotoUpload:(entry:CheckIn,angle:PhotoAngle,file?:File)=>Promise<void>}) {
  const [view,setView] = useState<MeasureView>("History");
  return <div className="content-stack measure-area"><section className="section-head"><div><p className="eyebrow">BODY TRACKING</p><h1>Measure progress.</h1></div><button className="primary" onClick={onAdd}>＋ Add</button></section><div className="segmented" role="tablist">{(["History","Compare","Photos"] as MeasureView[]).map(item => <button key={item} role="tab" aria-selected={view===item} className={view===item?"selected":""} onClick={()=>setView(item)}>{item}</button>)}</div>{view === "History" && <History entries={entries} onEdit={onEdit}/>} {view === "Compare" && <Compare entries={entries}/>} {view === "Photos" && <PhotoGallery entries={entries} onAdd={onAdd} onUpload={onPhotoUpload}/>}</div>;
}

function History({entries,onEdit}:{entries:CheckIn[];onEdit:(entry:CheckIn)=>void}) {
  const newest = [...entries].reverse();
  const weights = entries.map(item=>item.weight); const min = Math.min(...weights)-1; const max = Math.max(...weights)+1;
  return <><section className="trend-card"><div className="trend-copy"><div><p className="eyebrow">WEIGHT TREND</p><h2>{entries.at(-1)?.weight} kg</h2></div><span>{entries.length > 1 ? `${(entries.at(-1)!.weight-entries[0].weight).toFixed(1)} kg` : "Add a second entry"}</span></div><div className="bar-chart" aria-label="Weight history chart">{entries.map(entry => <div key={entry.id} className="bar-wrap"><span style={{height:`${35 + ((entry.weight-min)/(max-min))*65}%`}}/><small>{new Date(`${entry.date}T12:00:00`).toLocaleString("en-AU",{month:"short"})}</small></div>)}</div></section><section className="history-stack"><p className="eyebrow">ALL CHECK-INS</p>{newest.map((entry,index)=><button className="history-card" key={entry.id} onClick={()=>onEdit(entry)}><div className="history-date"><strong>{new Date(`${entry.date}T12:00:00`).getDate()}</strong><span>{new Date(`${entry.date}T12:00:00`).toLocaleString("en-AU",{month:"short"}).toUpperCase()}<br/>{entry.date.slice(0,4)}</span></div><div><h2>{entry.weight} kg</h2><p>{index===0?"Latest check-in":`${entry.measurements.waist} cm waist`} · {entry.photos.length ? `${entry.photos.length} photos` : "No photos"}</p></div><span>›</span></button>)}</section></>;
}

function Compare({entries}:{entries:CheckIn[]}) {
  const [fromId,setFromId] = useState(entries[0].id); const [toId,setToId] = useState(entries.at(-1)!.id);
  const from = entries.find(item=>item.id===fromId)!; const to = entries.find(item=>item.id===toId)!;
  const rows = [{key:"weight",label:"Weight",unit:"kg",a:from.weight,b:to.weight},...measurementFields.map(field=>({key:field.key,label:field.label,unit:"cm",a:from.measurements[field.key],b:to.measurements[field.key]}))];
  return <><section className="compare-pickers"><label>From<select value={fromId} onChange={e=>setFromId(e.target.value)}>{entries.map(entry=><option value={entry.id} key={entry.id}>{formatDate(entry.date)}</option>)}</select></label><span>→</span><label>To<select value={toId} onChange={e=>setToId(e.target.value)}>{entries.map(entry=><option value={entry.id} key={entry.id}>{formatDate(entry.date)}</option>)}</select></label></section>{entries.length===1&&<div className="soft-note"><strong>Your comparison is ready.</strong><p>Add a second check-in to reveal changes against this baseline.</p></div>}<section className="delta-list"><div className="delta-head"><span>Measurement</span><span>Then</span><span>Now</span><span>Change</span></div>{rows.map(row=>{const delta=row.b-row.a;return <div key={row.key}><strong>{row.label}</strong><span>{row.a}</span><span>{row.b}</span><em className={delta>0?"up":delta<0?"down":"same"}>{delta>0?"+":""}{Number(delta.toFixed(1))} {row.unit}</em></div>})}</section></>;
}

function PhotoGallery({entries,onAdd,onUpload}:{entries:CheckIn[];onAdd:()=>void;onUpload:(entry:CheckIn,angle:PhotoAngle,file?:File)=>Promise<void>}) {
  const count=entries.reduce((total,item)=>total+item.photos.length,0);
  const [filter,setFilter]=useState<"all"|PhotoAngle>("all");const [photoUrls,setPhotoUrls]=useState<Record<string,string>>({});const [activePhoto,setActivePhoto]=useState<{url:string;angle:PhotoAngle;date:string}|null>(null);const allPhotos=entries.flatMap(entry=>entry.photos);const photoKey=allPhotos.map(photo=>photo.storagePath).join("|");const timeline=[...entries].reverse();
  useEffect(()=>{let cancelled=false;Promise.all(allPhotos.map(async photo=>[photo.storagePath,await cloudFitnessRepository.photoUrl(photo.storagePath)] as const)).then(pairs=>{if(!cancelled)setPhotoUrls(Object.fromEntries(pairs))}).catch(()=>undefined);return()=>{cancelled=true}},[photoKey]);
  return <><section className="photo-intro"><div className="photo-lock">⌾</div><p className="eyebrow">PRIVATE BY DESIGN</p><h2>{count ? `${count} progress photos` : "Your photo timeline starts here."}</h2><p>Photos are stored privately in Supabase. Only the signed-in owner can retrieve them.</p><button className="primary" onClick={onAdd}>Start photo check-in</button></section><div className="photo-filters" aria-label="Filter progress photos">{(["all","front","side","back"] as const).map(item=><button className={filter===item?"selected":""} key={item} onClick={()=>setFilter(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}</div><section className="photo-timeline">{timeline.map((entry,index)=>{const angles:PhotoAngle[]=filter==="all"?["front","side","back"]:[filter];return <article className="photo-set" key={entry.id}><header><div><p className="eyebrow">{index===0?"LATEST CHECK-IN":"CHECK-IN"}</p><h2>{formatDate(entry.date,true)}</h2></div><span>{entry.photos.length}/3 photos</span></header><div className={`photo-grid ${filter!=="all"?"single-angle":""}`}>{angles.map(angle=>{const photo=entry.photos.find(item=>item.angle===angle);const url=photo&&photoUrls[photo.storagePath];const label=angle[0].toUpperCase()+angle.slice(1);return <article className={url?"has-photo":""} key={angle}>{url?<><button className="photo-view" onClick={()=>setActivePhoto({url,angle,date:entry.date})} aria-label={`View ${label} photo from ${formatDate(entry.date)}`}><img src={url} alt={`${label} progress photo from ${formatDate(entry.date)}`}/><span>{label}</span></button><label className="photo-replace"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>onUpload(entry,angle,event.target.files?.[0])}/>Replace</label></>:<label className="photo-empty"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>onUpload(entry,angle,event.target.files?.[0])}/><span>＋</span><strong>{label}</strong><small>Add photo</small></label>}</article>})}</div></article>})}</section><div className="soft-note"><strong>Consistency tip</strong><p>Use the same room, distance, lighting and relaxed pose each time for useful comparisons.</p></div>{activePhoto&&<div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`${activePhoto.angle} progress photo`} onClick={()=>setActivePhoto(null)}><button onClick={()=>setActivePhoto(null)} aria-label="Close photo">×</button><img src={activePhoto.url} alt={`${activePhoto.angle} progress photo enlarged`}/><strong>{activePhoto.angle[0].toUpperCase()+activePhoto.angle.slice(1)} · {formatDate(activePhoto.date)}</strong></div>}</>;
}

function CheckInSheet({initial,isNew,onClose,onSave,onDelete}:{initial:CheckIn;isNew:boolean;userId:string;onClose:()=>void;onSave:(entry:CheckIn,photos?:Partial<Record<PhotoAngle,File>>)=>Promise<void>;onDelete:(entry:CheckIn)=>void}) {
  const groups=["Upper body","Core","Lower body"];
  const [confirmDelete,setConfirmDelete]=useState(false);const [pendingPhotos,setPendingPhotos]=useState<Partial<Record<PhotoAngle,File>>>({});const [photoPreviews,setPhotoPreviews]=useState<Partial<Record<PhotoAngle,string>>>({});const [saving,setSaving]=useState(false);
  function selectPhoto(angle:PhotoAngle,file?:File){if(!file)return;setPendingPhotos(current=>({...current,[angle]:file}));const reader=new FileReader();reader.onload=()=>setPhotoPreviews(current=>({...current,[angle]:String(reader.result)}));reader.readAsDataURL(file)}
  return <div className="sheet-backdrop" onClick={onClose}><form className="sheet checkin-sheet" onClick={e=>e.stopPropagation()} onSubmit={async e=>{e.preventDefault();setSaving(true);const data=new FormData(e.currentTarget);const measurements=Object.fromEntries(measurementFields.map(field=>[field.key,Number(data.get(field.key))])) as Measurements;await onSave({id:isNew?crypto.randomUUID():initial.id,date:String(data.get("date")),weight:Number(data.get("weight")),measurements,notes:String(data.get("notes")||""),photos:initial.photos,createdAt:isNew?new Date().toISOString():initial.createdAt},pendingPhotos);setSaving(false)}}><div className="sheet-handle"/><div className="sheet-head"><div><p className="eyebrow">{isNew?"NEW CHECK-IN":"CHECK-IN DETAILS"}</p><h2>{isNew?"Record your body":"Review and edit"}</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></div><div className="sheet-scroll"><div className="form-grid top-fields"><label>Date<input type="date" name="date" defaultValue={isNew?new Date().toISOString().slice(0,10):initial.date} required/></label><label>Weight <span>kg</span><input name="weight" inputMode="decimal" type="number" step="0.1" min="1" defaultValue={initial.weight} required/></label></div>{groups.map(group=><fieldset key={group}><legend>{group}</legend><div className="form-grid">{measurementFields.filter(field=>field.group===group).map(field=><label key={field.key}>{field.label} <span>cm</span><input name={field.key} inputMode="decimal" type="number" step="0.1" min="1" defaultValue={initial.measurements[field.key]} required/></label>)}</div></fieldset>)}<fieldset><legend>Progress photos</legend><div className="photo-inputs">{(["front","side","back"] as PhotoAngle[]).map(angle=><label className={`photo-upload ${photoPreviews[angle]?"has-preview":""}`} key={angle}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>selectPhoto(angle,e.target.files?.[0])}/>{photoPreviews[angle]?<><img src={photoPreviews[angle]} alt={`${angle} photo preview`}/><span className="photo-ready">✓</span><strong>{angle[0].toUpperCase()+angle.slice(1)}</strong><small>Ready to upload</small></>:<><span className="photo-add">＋</span>{angle[0].toUpperCase()+angle.slice(1)}<small>{initial.photos.some(p=>p.angle===angle)?"Choose replacement":"Choose photo"}</small></>}</label>)}</div>{Object.keys(pendingPhotos).length>0&&<p className="photo-notice" role="status">Photos will upload securely when you save this check-in.</p>}</fieldset><label className="notes-label">Notes<textarea name="notes" rows={3} defaultValue={initial.notes} placeholder="Lighting, training phase, how you feel…"/></label></div><div className="sheet-actions">{!isNew&&!confirmDelete&&<button className="danger-link" type="button" onClick={()=>setConfirmDelete(true)}>Delete</button>}{confirmDelete&&<button className="danger" type="button" onClick={()=>onDelete(initial)}>Confirm delete</button>}<button className="primary save" type="submit" disabled={saving}>{saving?"Saving securely…":isNew?"Save check-in":"Save changes"}</button></div></form></div>;
}

function Placeholder({kind}:{kind:"workouts"|"goals"}) { const workout=kind==="workouts"; return <div className="content-stack"><section className="empty-state"><span className="empty-icon">{workout?"↗":"◎"}</span><p className="eyebrow">{workout?"TRAINING":"DIRECTION"}</p><h1>{workout?"Build your first workout.":"Set a target worth chasing."}</h1><p>{workout?"Exercises, sets, reps and reusable templates are planned after secure user accounts.":"Bodyweight and measurement targets will build on the complete check-in system."}</p><button className="primary">{workout?"Planned for v0.4":"Planned for v0.3"}</button></section></div>; }
