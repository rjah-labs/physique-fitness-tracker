"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { exerciseCatalog, muscleIcons, type Exercise } from "../lib/exercise-catalog";
import { measurementFields, type CheckIn } from "../lib/fitness-repository";

type GoalType="body_composition"|"body_measurement"|"strength"|"performance"|"consistency";
type GoalStatus="active"|"completed"|"paused"|"archived";
type Goal={id:string;goal_type:GoalType;metric:string;label:string;start_value:number;target_value:number;unit:"kg"|"cm"|"reps"|"sessions"|"minutes"|"km";priority:"primary"|"secondary";target_date:string|null;related_exercise_id:string|null;target_reps:number|null;notes:string|null;evaluation_period:"overall"|"weekly";status:GoalStatus};
type ExerciseResult={exercise_id:string;workout_sets:Array<{weight_kg:number|null;reps:number|null;duration_seconds:number|null;distance_km:number|null;completed:boolean}>};
type WorkoutResult={completed_at:string};
export type GoalSummary={id:string;label:string;goal_type:GoalType;target_value:number;unit:Goal["unit"];target_date:string|null;target_reps:number|null};

const goalTypes:Array<{id:GoalType;icon:string;label:string;copy:string}>=[
  {id:"body_composition",icon:"↘",label:"Body weight",copy:"Reach or change a bodyweight target."},
  {id:"body_measurement",icon:"◇",label:"Body size",copy:"Track a specific circumference change."},
  {id:"strength",icon:"↑",label:"Strength",copy:"Lift a target weight for chosen reps."},
  {id:"performance",icon:"⚡",label:"Performance",copy:"Improve repetitions in a bodyweight movement."},
  {id:"consistency",icon:"✓",label:"Consistency",copy:"Complete a number of sessions each week."},
];

const formatNumber=(value:number)=>Number(value.toFixed(1));
const unitLabel=(goal:Goal)=>goal.unit==="sessions"?"sessions / week":goal.unit;
const asSummary=(goal:Goal):GoalSummary=>({id:goal.id,label:goal.label,goal_type:goal.goal_type,target_value:Number(goal.target_value),unit:goal.unit,target_date:goal.target_date,target_reps:goal.target_reps});

export async function loadPrimaryGoal(userId:string):Promise<GoalSummary|null>{
  const {data,error}=await supabase.from("goals").select("id,label,goal_type,target_value,unit,target_date,target_reps").eq("user_id",userId).eq("priority","primary").eq("status","active").maybeSingle();
  if(error)throw error;return data?data as GoalSummary:null;
}

export function GoalsArea({userId,current,onNotice,onSummary}:{userId:string;current:CheckIn;onNotice:(message:string)=>void;onSummary?:(goal:GoalSummary|null)=>void}){
  const [goals,setGoals]=useState<Goal[]>([]);const [adding,setAdding]=useState(false);const [editing,setEditing]=useState<Goal|null>(null);const [goalType,setGoalType]=useState<GoalType|null>(null);const [busy,setBusy]=useState(false);
  const [exerciseResults,setExerciseResults]=useState<ExerciseResult[]>([]);const [workouts,setWorkouts]=useState<WorkoutResult[]>([]);

  async function load(){
    const [goalResult,exerciseResult,workoutResult]=await Promise.all([
      supabase.from("goals").select("id,goal_type,metric,label,start_value,target_value,unit,priority,target_date,related_exercise_id,target_reps,notes,evaluation_period,status").eq("user_id",userId).neq("status","archived").order("priority").order("updated_at",{ascending:false}),
      supabase.from("workout_exercises").select("exercise_id,workout_sets(weight_kg,reps,duration_seconds,distance_km,completed)"),
      supabase.from("workouts").select("completed_at").not("completed_at","is",null).order("completed_at",{ascending:false}),
    ]);
    const error=goalResult.error||exerciseResult.error||workoutResult.error;
    if(error)onNotice(error.message);else{const next=(goalResult.data||[]) as Goal[];setGoals(next);setExerciseResults((exerciseResult.data||[]) as ExerciseResult[]);setWorkouts((workoutResult.data||[]) as WorkoutResult[]);onSummary?.(next.find(goal=>goal.priority==="primary"&&goal.status==="active")?asSummary(next.find(goal=>goal.priority==="primary"&&goal.status==="active")!):null)}
  }
  useEffect(()=>{load()},[userId]);

  const stats=useMemo(()=>{
    const values:Record<string,{weight:number;reps:number;minutes:number;km:number}>={};
    for(const result of exerciseResults){const item=values[result.exercise_id]||{weight:0,reps:0,minutes:0,km:0};for(const set of result.workout_sets||[]){if(!set.completed)continue;item.weight=Math.max(item.weight,Number(set.weight_kg||0));item.reps=Math.max(item.reps,Number(set.reps||0));item.minutes=Math.max(item.minutes,Number(set.duration_seconds||0)/60);item.km=Math.max(item.km,Number(set.distance_km||0))}values[result.exercise_id]=item}return values;
  },[exerciseResults]);

  function weeklySessions(){const now=new Date();const day=(now.getDay()+6)%7;const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-day);return workouts.filter(item=>new Date(item.completed_at)>=start).length}
  function currentValue(goal:Pick<Goal,"goal_type"|"metric"|"unit"|"related_exercise_id"|"target_reps">){
    if(goal.goal_type==="body_composition")return current.weight;
    if(goal.goal_type==="body_measurement")return current.measurements[goal.metric as keyof typeof current.measurements]||0;
    if(goal.goal_type==="consistency")return weeklySessions();
    if(goal.unit==="kg"){const result=exerciseResults.find(item=>item.exercise_id===goal.related_exercise_id);return Math.max(0,...(result?.workout_sets||[]).filter(set=>set.completed&&Number(set.reps||0)>=Number(goal.target_reps||1)).map(set=>Number(set.weight_kg||0)))}
    const exerciseStats=stats[goal.related_exercise_id||""]||{weight:0,reps:0,minutes:0,km:0};
    return goal.unit==="reps"?exerciseStats.reps:goal.unit==="minutes"?exerciseStats.minutes:exerciseStats.km;
  }
  function progressFor(goal:Goal){const now=currentValue(goal),distance=goal.target_value-goal.start_value;if(distance===0)return 100;return Math.max(0,Math.min(100,((now-goal.start_value)/distance)*100))}
  function closeDialog(){setAdding(false);setEditing(null);setGoalType(null)}

  async function create(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!goalType)return;if(goals.filter(goal=>goal.status==="active").length>=3){onNotice("Keep up to three active goals: one primary and two secondary");return}
    setBusy(true);const form=new FormData(event.currentTarget);let metric="",label="",unit:Goal["unit"]="kg",exercise:Exercise|undefined,targetReps:null|number=null,evaluationPeriod:Goal["evaluation_period"]="overall";
    if(goalType==="body_composition"){metric="weight";label="Body weight";unit="kg"}
    if(goalType==="body_measurement"){metric=String(form.get("measurement"));label=measurementFields.find(item=>item.key===metric)?.label||"Body measurement";unit="cm"}
    if(goalType==="strength"){metric="strength";exercise=exerciseCatalog.find(item=>item.id===String(form.get("exercise")));label=`${exercise?.name||"Exercise"} strength`;unit="kg";targetReps=Number(form.get("target_reps")||1)}
    if(goalType==="performance"){metric="performance";exercise=exerciseCatalog.find(item=>item.id===String(form.get("exercise")));label=`${exercise?.name||"Exercise"} performance`;unit="reps"}
    if(goalType==="consistency"){metric="workout_frequency";label="Weekly training";unit="sessions";evaluationPeriod="weekly"}
    const draft={goal_type:goalType,metric,unit,related_exercise_id:exercise?.id||null,target_reps:targetReps};const startValue=currentValue(draft);const priority=String(form.get("priority")) as Goal["priority"];
    if(priority==="primary"){const {error}=await supabase.from("goals").update({priority:"secondary",updated_at:new Date().toISOString()}).eq("user_id",userId).eq("priority","primary").in("status",["active","paused"]);if(error){setBusy(false);onNotice(error.message);return}}
    const {error}=await supabase.from("goals").insert({user_id:userId,goal_type:goalType,metric,label,start_value:startValue,target_value:Number(form.get("target")),unit,priority,target_date:form.get("date")||null,related_exercise_id:exercise?.id||null,target_reps:targetReps,notes:String(form.get("notes")||"").trim()||null,evaluation_period:evaluationPeriod,start_date:new Date().toISOString().slice(0,10)});
    setBusy(false);if(error){onNotice(error.message);return}closeDialog();onNotice("Goal securely saved");load()
  }
  async function setStatus(goal:Goal,status:GoalStatus){const {error}=await supabase.from("goals").update({status,updated_at:new Date().toISOString()}).eq("id",goal.id);if(error)onNotice(error.message);else{onNotice(status==="completed"?"Goal completed":status==="paused"?"Goal paused":status==="active"?"Goal resumed":"Goal archived");load()}}
  async function updateGoal(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!editing)return;setBusy(true);const form=new FormData(event.currentTarget);const priority=String(form.get("priority")) as Goal["priority"];
    if(priority==="primary"&&editing.priority!=="primary"){const {error}=await supabase.from("goals").update({priority:"secondary",updated_at:new Date().toISOString()}).eq("user_id",userId).eq("priority","primary").in("status",["active","paused"]);if(error){setBusy(false);onNotice(error.message);return}}
    const changes={target_value:Number(form.get("target")),target_reps:editing.goal_type==="strength"?Number(form.get("target_reps")||1):editing.target_reps,priority,target_date:form.get("date")||null,notes:String(form.get("notes")||"").trim()||null,updated_at:new Date().toISOString()};
    const {error}=await supabase.from("goals").update(changes).eq("id",editing.id).eq("user_id",userId);setBusy(false);if(error){onNotice(error.message);return}closeDialog();onNotice("Goal updated");load()
  }

  const activeGoals=goals.filter(goal=>goal.status==="active");
  const guidance=goalGuidance(activeGoals);
  return <div className="content-stack goals-area"><section className="section-head"><div><p className="eyebrow">YOUR DIRECTION</p><h1>Goals.</h1></div><button className="primary" onClick={()=>setAdding(true)}>＋ Add goal</button></section>
    <section className="goal-overview"><div><strong>{activeGoals.length}</strong><span>active</span></div><p>{activeGoals.find(goal=>goal.priority==="primary")?.label||"Choose a primary goal"}<small>Primary focus</small></p></section>
    {guidance&&<section className="goal-guidance"><span>↔</span><div><strong>{guidance.title}</strong><p>{guidance.copy}</p></div></section>}
    <div className="soft-note"><strong>Progress, not promises.</strong><p>Physique tracks measurable outcomes and training behaviour. Body measurements can vary and are not treated as proof of muscle or fat change.</p></div>
    {goals.length===0?<section className="empty-training"><span>◎</span><h2>Set your first target.</h2><p>Choose weight, body size, strength, performance or training consistency.</p></section>:<section className="goal-stack">{goals.map(goal=>{const now=currentValue(goal),progress=progressFor(goal),definition=goalTypes.find(item=>item.id===goal.goal_type);return <article className={`goal-card ${goal.status} ${goal.priority}`} key={goal.id}><header><div className="goal-heading"><span>{definition?.icon}</span><div><p className="eyebrow">{goal.priority} · {goal.status}</p><h2>{goal.label}</h2></div></div><strong>{Math.round(progress)}%</strong></header><div className="goal-track"><span style={{width:`${progress}%`}}/></div><div className="goal-values"><span>Started <b>{formatNumber(goal.start_value)} {unitLabel(goal)}</b></span><span>Now <b>{formatNumber(now)} {unitLabel(goal)}</b></span><span>Target <b>{formatNumber(goal.target_value)} {unitLabel(goal)}</b></span></div>{goal.target_reps&&<p className="goal-detail">Target lift · {goal.target_value} kg for {goal.target_reps} {goal.target_reps===1?"rep":"reps"}</p>}{goal.target_date&&<p className="goal-date">Target date · {new Date(`${goal.target_date}T12:00:00`).toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"})}</p>}{goal.notes&&<p className="goal-notes">{goal.notes}</p>}<footer><button onClick={()=>setEditing(goal)}>Edit</button><button onClick={()=>setStatus(goal,"archived")}>Archive</button>{goal.status==="active"?<button onClick={()=>setStatus(goal,"paused")}>Pause</button>:goal.status==="paused"?<button onClick={()=>setStatus(goal,"active")}>Resume</button>:null}{goal.status!=="completed"&&<button onClick={()=>setStatus(goal,"completed")}>Complete</button>}</footer></article>})}</section>}
    {adding&&<div className="mini-picker goal-dialog"><form onSubmit={create}><header><div><p className="eyebrow">NEW GOAL</p><h2>{goalType?goalTypes.find(item=>item.id===goalType)?.label:"What are you working towards?"}</h2></div><button type="button" onClick={closeDialog}>×</button></header>{!goalType?<div className="goal-type-grid">{goalTypes.map(type=><button type="button" key={type.id} onClick={()=>setGoalType(type.id)}><span>{type.icon}</span><strong>{type.label}</strong><small>{type.copy}</small></button>)}</div>:<><button className="goal-back" type="button" onClick={()=>setGoalType(null)}>← Change goal type</button><GoalFields type={goalType}/><label>Priority<select name="priority" defaultValue={activeGoals.some(goal=>goal.priority==="primary")?"secondary":"primary"}><option value="primary">Primary focus</option><option value="secondary">Secondary goal</option></select></label><label>Target date <span>optional</span><input name="date" type="date" min={new Date().toISOString().slice(0,10)}/></label><label>Notes <span>optional</span><textarea name="notes" rows={2} maxLength={1000} placeholder="Why this matters or anything to remember…"/></label><div className="goal-boundary"><strong>A tracking target, not a guarantee</strong><p>Physique will measure progress without diagnosing health conditions or promising a particular result.</p></div><button className="primary" disabled={busy}>{busy?"Saving…":"Create goal"}</button></>}</form></div>}
    {editing&&<div className="mini-picker goal-dialog"><form onSubmit={updateGoal}><header><div><p className="eyebrow">EDIT GOAL</p><h2>{editing.label}</h2></div><button type="button" onClick={closeDialog}>×</button></header><div className="goal-explainer"><strong>{goalTypes.find(type=>type.id===editing.goal_type)?.label}</strong><p>The original starting point stays fixed so progress remains meaningful.</p></div><label>Target <span>{unitLabel(editing)}</span><input name="target" type="number" inputMode="decimal" min="1" step={editing.unit==="kg"||editing.unit==="cm"?"0.1":"1"} defaultValue={editing.target_value} required/></label>{editing.goal_type==="strength"&&<label>Target repetitions<input name="target_reps" type="number" inputMode="numeric" min="1" max="100" defaultValue={editing.target_reps||1} required/></label>}<label>Priority<select name="priority" defaultValue={editing.priority}><option value="primary">Primary focus</option><option value="secondary">Secondary goal</option></select></label><label>Target date <span>optional</span><input name="date" type="date" defaultValue={editing.target_date||""}/></label><label>Notes <span>optional</span><textarea name="notes" rows={3} maxLength={1000} defaultValue={editing.notes||""}/></label><button className="primary" disabled={busy}>{busy?"Saving…":"Save changes"}</button></form></div>}
  </div>;
}

function goalGuidance(goals:Goal[]){
  const weightLoss=goals.find(goal=>goal.goal_type==="body_composition"&&goal.target_value<goal.start_value);
  const weightGain=goals.find(goal=>goal.goal_type==="body_composition"&&goal.target_value>goal.start_value);
  const sizeGain=goals.find(goal=>goal.goal_type==="body_measurement"&&goal.target_value>goal.start_value);
  const waistLoss=goals.find(goal=>goal.goal_type==="body_measurement"&&["waist","abdomen"].includes(goal.metric)&&goal.target_value<goal.start_value);
  if(weightLoss&&sizeGain)return {title:"Two outcomes may compete",copy:"Reducing bodyweight while increasing a body measurement can both be valid, but progress may not happen at the same rate. Keep one as your primary focus."};
  if(weightGain&&waistLoss)return {title:"Watch the trade-off",copy:"Increasing bodyweight while reducing your waist may require a slower, patient approach. Use your primary goal to show which outcome matters most."};
  const soon=goals.find(goal=>goal.target_date&&(new Date(`${goal.target_date}T12:00:00`).getTime()-Date.now())<28*86400000&&Math.abs(goal.target_value-goal.start_value)>(goal.unit==="kg"?5:goal.unit==="cm"?3:Number.POSITIVE_INFINITY));
  if(soon)return {title:"Ambitious timeline",copy:"This target asks for a substantial change in under four weeks. Physique will track it without treating the deadline as a promised outcome."};
  return null;
}

function GoalFields({type}:{type:GoalType}){
  const [exerciseId,setExerciseId]=useState("");const performanceExercises=exerciseCatalog.filter(item=>item.tracking==="reps");
  if(type==="body_composition")return <><div className="goal-explainer"><strong>Bodyweight target</strong><p>Your starting point comes from your latest check-in.</p></div><label>Target weight <span>kg</span><input name="target" type="number" inputMode="decimal" min="1" step="0.1" required/></label></>;
  if(type==="body_measurement")return <><label>Measurement<select name="measurement" required>{measurementFields.map(field=><option value={field.key} key={field.key}>{field.label}</option>)}</select></label><label>Target measurement <span>cm</span><input name="target" type="number" inputMode="decimal" min="1" step="0.1" required/></label></>;
  if(type==="strength")return <><label>Exercise<select name="exercise" value={exerciseId} onChange={event=>setExerciseId(event.target.value)} required><option value="">Choose an exercise</option>{exerciseCatalog.filter(item=>item.tracking==="weight_reps").map(item=><option value={item.id} key={item.id}>{muscleIcons[item.group]} {item.name}</option>)}</select></label><div className="goal-pair"><label>Target weight <span>kg</span><input name="target" type="number" inputMode="decimal" min="1" step="0.5" required/></label><label>For reps<input name="target_reps" type="number" inputMode="numeric" min="1" max="100" defaultValue="1" required/></label></div></>;
  if(type==="performance")return <><label>Exercise<select name="exercise" value={exerciseId} onChange={event=>setExerciseId(event.target.value)} required><option value="">Choose an exercise</option>{performanceExercises.map(item=><option value={item.id} key={item.id}>{muscleIcons[item.group]} {item.name}</option>)}</select></label><label>Target repetitions <span>reps</span><input name="target" type="number" inputMode="numeric" min="1" step="1" required/></label></>;
  return <><div className="goal-explainer"><strong>Weekly consistency</strong><p>Progress resets each Monday and counts completed workouts.</p></div><label>Sessions each week<input name="target" type="number" inputMode="numeric" min="1" max="14" step="1" required/></label></>;
}
