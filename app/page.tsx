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
  return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">P</div><p className="eyebrow">PHYSIQUE <span className="version">V0.4</span></p><h1>Your progress.<br/>Private and synced.</h1><p>Sign in to access your measurements, workouts and progress photos on any device.</p><form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Password<input name="password" type="password" minLength={6} autoComplete={mode==="signin"?"current-password":"new-password"} required/></label>{message&&<p className="auth-message" role="status">{message}</p>}<button className="primary" disabled={busy}>{busy?"Please wait…":mode==="signin"?"Sign in":"Create account"}</button></form><button className="auth-switch" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setMessage("")}}>{mode==="signin"?"New here? Create an account":"Already have an account? Sign in"}</button></section></main>
}

function FitnessApp({user}:{user:User}) {
  const [tab, setTab] = useState<Tab>("Today");
  const [checkIns, setCheckIns] = useState<CheckIn[]>([baselineCheckIn]);
  const [editing, setEditing] = useState<CheckIn | null | "new">(null);
  const [notice, setNotice] = useState("");
  const latest = checkIns.at(-1) || baselineCheckIn;

  useEffect(() => {
    cloudFitnessRepository.importLocal(user.id).then(setCheckIns).catch(error=>setNotice(error.message));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }, []);

  async function refresh(message: string) {
    setCheckIns(await cloudFitnessRepository.list()); setEditing(null); setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }
  async function save(entry:CheckIn){try{await cloudFitnessRepository.save(entry,user.id);await refresh(editing==="new"?"Check-in securely synced":"Check-in updated")}catch(error){setNotice(error instanceof Error?error.message:"Unable to save")}}
  async function remove(entry:CheckIn){try{await cloudFitnessRepository.remove(entry);await refresh("Check-in removed")}catch(error){setNotice(error instanceof Error?error.message:"Unable to delete")}}

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">P</div><div><p className="eyebrow">PHYSIQUE <span className="version">V0.4</span></p><p className="date">{formatDate(latest.date, true)}</p></div><button className="avatar" aria-label="Sign out" title="Sign out" onClick={()=>supabase.auth.signOut()}>{(user.email||"U").slice(0,2).toUpperCase()}</button></header>
    <section className="hero"><p className="eyebrow">CURRENT WEIGHT</p><div className="weight-row"><strong>{latest.weight}</strong><span>kg</span></div><div className="target-track"><span style={{width:"72%"}}/></div><div className="target-copy"><span>{checkIns.length} {checkIns.length === 1 ? "check-in" : "check-ins"}</span><span>Next target · 100 kg</span></div></section>
    {tab === "Today" && <Dashboard latest={latest} count={checkIns.length} onLog={() => setEditing("new")} onMeasure={() => setTab("Measure")}/>} 
    {tab === "Measure" && <MeasurementsArea entries={checkIns} onAdd={() => setEditing("new")} onEdit={setEditing}/>} 
    {tab === "Train" && <WorkoutArea userId={user.id} onNotice={message=>{setNotice(message);window.setTimeout(()=>setNotice(""),2600)}}/>} {tab === "Goals" && <Placeholder kind="goals"/>}
    <nav className="bottom-nav" aria-label="Primary navigation">{(["Today","Measure","Train","Goals"] as Tab[]).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}><span aria-hidden="true">{item === "Today" ? "⌂" : item === "Measure" ? "◇" : item === "Train" ? "＋" : "◎"}</span>{item}</button>)}</nav>
    {editing && <CheckInSheet initial={editing === "new" ? latest : editing} isNew={editing === "new"} userId={user.id} onClose={() => setEditing(null)} onSave={save} onDelete={remove}/>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </main>;
}

function Dashboard({latest,count,onLog,onMeasure}:{latest:CheckIn;count:number;onLog:()=>void;onMeasure:()=>void}) {
  const featured: Array<[MeasurementKey,string]> = [["shoulders","lime"],["chest","blue"],["waist","coral"],["hipsGlutes","violet"]];
  return <div className="content-stack"><section className="section-head"><div><p className="eyebrow">LATEST SNAPSHOT</p><h1>Keep building.</h1></div><button className="primary" onClick={onLog}>＋ Check-in</button></section><section className="metric-grid">{featured.map(([key,tone]) => <Metric key={key} value={latest.measurements[key]} label={measurementFields.find(field => field.key === key)!.label} tone={tone}/>)}</section><button className="plan-card" onClick={onMeasure}><div><p className="eyebrow">MEASUREMENT HISTORY</p><h2>{count === 1 ? "Your baseline is ready" : `${count} check-ins recorded`}</h2><p>{count === 1 ? "Add another check-in to unlock comparisons." : "Compare any two dates and see every change."}</p></div><span>→</span></button><section className="insight-card"><p className="eyebrow">PROGRESS PHOTOS</p><h2>Same angles. Honest progress.</h2><p>Front, side and back photo slots are prepared for private Supabase storage.</p></section></div>;
}

function Metric({value,label,tone}:{value:number;label:string;tone:string}) { return <article className={`metric ${tone}`}><div><strong>{value}</strong><span>cm</span></div><p>{label}</p></article>; }

function MeasurementsArea({entries,onAdd,onEdit}:{entries:CheckIn[];onAdd:()=>void;onEdit:(entry:CheckIn)=>void}) {
  const [view,setView] = useState<MeasureView>("History");
  return <div className="content-stack measure-area"><section className="section-head"><div><p className="eyebrow">BODY TRACKING</p><h1>Measure progress.</h1></div><button className="primary" onClick={onAdd}>＋ Add</button></section><div className="segmented" role="tablist">{(["History","Compare","Photos"] as MeasureView[]).map(item => <button key={item} role="tab" aria-selected={view===item} className={view===item?"selected":""} onClick={()=>setView(item)}>{item}</button>)}</div>{view === "History" && <History entries={entries} onEdit={onEdit}/>} {view === "Compare" && <Compare entries={entries}/>} {view === "Photos" && <PhotoGallery entries={entries} onAdd={onAdd}/>}</div>;
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

function PhotoGallery({entries,onAdd}:{entries:CheckIn[];onAdd:()=>void}) {
  const count=entries.reduce((total,item)=>total+item.photos.length,0);
  return <><section className="photo-intro"><div className="photo-lock">⌾</div><p className="eyebrow">PRIVATE BY DESIGN</p><h2>{count ? `${count} progress photos` : "Your photo timeline starts here."}</h2><p>Progress photos will use private Supabase storage. Only the signed-in owner will be able to retrieve them.</p><button className="primary" onClick={onAdd}>Start photo check-in</button></section><section className="photo-grid" aria-label="Progress photo angles">{["Front","Side","Back"].map(angle=><article key={angle}><span>＋</span><strong>{angle}</strong><small>Secure upload in Supabase release</small></article>)}</section><div className="soft-note"><strong>Consistency tip</strong><p>Use the same room, distance, lighting and relaxed pose each time for useful comparisons.</p></div></>;
}

function CheckInSheet({initial,isNew,userId,onClose,onSave,onDelete}:{initial:CheckIn;isNew:boolean;userId:string;onClose:()=>void;onSave:(entry:CheckIn)=>void;onDelete:(entry:CheckIn)=>void}) {
  const groups=["Upper body","Core","Lower body"];
  const [confirmDelete,setConfirmDelete]=useState(false);const [photoNotice,setPhotoNotice]=useState("");
  async function upload(angle:PhotoAngle,file?:File){if(!file)return;if(isNew){setPhotoNotice("Save the check-in first, then add photos.");return}try{setPhotoNotice("Uploading securely…");await cloudFitnessRepository.uploadPhoto(initial,userId,angle,file);setPhotoNotice(`${angle[0].toUpperCase()+angle.slice(1)} photo uploaded.`)}catch(error){setPhotoNotice(error instanceof Error?error.message:"Upload failed")}}
  return <div className="sheet-backdrop" onClick={onClose}><form className="sheet checkin-sheet" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);const measurements=Object.fromEntries(measurementFields.map(field=>[field.key,Number(data.get(field.key))])) as Measurements;onSave({id:isNew?crypto.randomUUID():initial.id,date:String(data.get("date")),weight:Number(data.get("weight")),measurements,notes:String(data.get("notes")||""),photos:initial.photos,createdAt:isNew?new Date().toISOString():initial.createdAt})}}><div className="sheet-handle"/><div className="sheet-head"><div><p className="eyebrow">{isNew?"NEW CHECK-IN":"CHECK-IN DETAILS"}</p><h2>{isNew?"Record your body":"Review and edit"}</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></div><div className="sheet-scroll"><div className="form-grid top-fields"><label>Date<input type="date" name="date" defaultValue={isNew?new Date().toISOString().slice(0,10):initial.date} required/></label><label>Weight <span>kg</span><input name="weight" inputMode="decimal" type="number" step="0.1" min="1" defaultValue={initial.weight} required/></label></div>{groups.map(group=><fieldset key={group}><legend>{group}</legend><div className="form-grid">{measurementFields.filter(field=>field.group===group).map(field=><label key={field.key}>{field.label} <span>cm</span><input name={field.key} inputMode="decimal" type="number" step="0.1" min="1" defaultValue={initial.measurements[field.key]} required/></label>)}</div></fieldset>)}<fieldset><legend>Progress photos</legend><div className="photo-inputs">{(["front","side","back"] as PhotoAngle[]).map(angle=><label className="photo-upload" key={angle}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload(angle,e.target.files?.[0])}/><span>＋</span>{angle[0].toUpperCase()+angle.slice(1)}<small>{initial.photos.some(p=>p.angle===angle)?"Replace photo":"Choose photo"}</small></label>)}</div>{photoNotice&&<p className="photo-notice" role="status">{photoNotice}</p>}</fieldset><label className="notes-label">Notes<textarea name="notes" rows={3} defaultValue={initial.notes} placeholder="Lighting, training phase, how you feel…"/></label></div><div className="sheet-actions">{!isNew&&!confirmDelete&&<button className="danger-link" type="button" onClick={()=>setConfirmDelete(true)}>Delete</button>}{confirmDelete&&<button className="danger" type="button" onClick={()=>onDelete(initial)}>Confirm delete</button>}<button className="primary save" type="submit">{isNew?"Save check-in":"Save changes"}</button></div></form></div>;
}

function Placeholder({kind}:{kind:"workouts"|"goals"}) { const workout=kind==="workouts"; return <div className="content-stack"><section className="empty-state"><span className="empty-icon">{workout?"↗":"◎"}</span><p className="eyebrow">{workout?"TRAINING":"DIRECTION"}</p><h1>{workout?"Build your first workout.":"Set a target worth chasing."}</h1><p>{workout?"Exercises, sets, reps and reusable templates are planned after secure user accounts.":"Bodyweight and measurement targets will build on the complete check-in system."}</p><button className="primary">{workout?"Planned for v0.4":"Planned for v0.3"}</button></section></div>; }
