import { exerciseCatalog } from "./exercise-catalog";
import { supabase } from "./supabase";
import type { TemplateExercise } from "./workout-repository";
import {calendarDate,nextScheduledDate,weekBounds} from "./program-calendar";

type PlannedExercise={exerciseId:string;name:string;sets:number;reps:string;restSeconds?:number;rir?:string;notes?:string};
type PlannedDay={day:number;name:string;focus:string;exercises:PlannedExercise[]};
type ProgramPlan={name:string;days:PlannedDay[];reviewWeeks:number;startDate?:string;timeZone?:string};

export type ProgramSession={
  programName:string;
  activatedAt:string;
  day:number;
  dayCount:number;
  name:string;
  focus:string;
  items:TemplateExercise[];
  scheduleDays:number[];
  scheduledDate:string;
  overdue:boolean;
  completedThisWeek:number;
  plannedThisWeek:number;
};

export async function loadNextProgramSession():Promise<ProgramSession|null>{
  const {data:program,error}=await supabase.from("training_programs").select("plan,activated_at,schedule_days").eq("status","active").maybeSingle();
  if(error)throw error;
  if(!program)return null;
  const plan=program.plan as ProgramPlan;
  if(!plan.days?.length)return null;
  const today=calendarDate(new Date(),plan.timeZone),week=weekBounds(today);
  const [workouts,skips]=await Promise.all([
    supabase.from("workouts").select("completed_at").eq("training_program_activated_at",program.activated_at).not("program_day","is",null).not("completed_at","is",null),
    supabase.from("program_skips").select("skipped_at").eq("training_program_activated_at",program.activated_at),
  ]);
  if(workouts.error)throw workouts.error;if(skips.error)throw skips.error;
  const completed=workouts.data||[],skipped=skips.data||[],progress=completed.length+skipped.length,next=plan.days[progress%plan.days.length];
  const scheduleDays=(program.schedule_days?.length?program.schedule_days:[1,3,5]) as number[];
  const startDate=plan.startDate||calendarDate(new Date(program.activated_at),plan.timeZone);
  const scheduledDate=nextScheduledDate(startDate,scheduleDays,progress);
  const inWeek=(value:string)=>{const date=calendarDate(new Date(value),plan.timeZone);return date>=week.start&&date<week.end};
  const completedThisWeek=completed.filter(item=>inWeek(item.completed_at)).length;
  const items:TemplateExercise[]=next.exercises.map(item=>{
    const exercise=exerciseCatalog.find(exercise=>exercise.id===item.exerciseId);
    if(!exercise)throw new Error(`Exercise library update required: ${item.name}`);
    return {exercise:{...exercise,name:item.name,restSeconds:item.restSeconds??exercise.restSeconds,coachingNotes:[item.rir?`RIR: ${item.rir}.`:"",item.notes].filter(Boolean).join(" ")},targetSets:item.sets,targetReps:item.reps};
  });
  let plannedThisWeek=0;for(let i=0;i<7;i++){const date=new Date(week.start+"T12:00:00Z");date.setUTCDate(date.getUTCDate()+i);if(date.toISOString().slice(0,10)>=startDate&&scheduleDays.includes(date.getUTCDay()))plannedThisWeek++;}
  return {programName:plan.name,activatedAt:program.activated_at,day:next.day,dayCount:plan.days.length,name:next.name,focus:next.focus,items,scheduleDays,scheduledDate,overdue:scheduledDate<today,completedThisWeek,plannedThisWeek};
}

export async function saveProgramSchedule(days:number[]){const {error}=await supabase.from("training_programs").update({schedule_days:days,updated_at:new Date().toISOString()}).eq("status","active");if(error)throw error}
export async function skipProgramSession(userId:string,session:ProgramSession){const {error}=await supabase.from("program_skips").insert({id:crypto.randomUUID(),user_id:userId,training_program_activated_at:session.activatedAt,program_day:session.day});if(error)throw error}
