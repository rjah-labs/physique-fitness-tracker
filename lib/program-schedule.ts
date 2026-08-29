import { exerciseCatalog } from "./exercise-catalog";
import { supabase } from "./supabase";
import type { TemplateExercise } from "./workout-repository";

type PlannedExercise={exerciseId:string;name:string;sets:number;reps:string};
type PlannedDay={day:number;name:string;focus:string;exercises:PlannedExercise[]};
type ProgramPlan={name:string;days:PlannedDay[];reviewWeeks:number};

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
  const today=new Date();today.setHours(12,0,0,0);const monday=new Date(today);monday.setDate(today.getDate()-((today.getDay()+6)%7));const weekEnd=new Date(monday);weekEnd.setDate(monday.getDate()+7);
  const [workouts,skips]=await Promise.all([
    supabase.from("workouts").select("completed_at").eq("training_program_activated_at",program.activated_at).not("program_day","is",null).not("completed_at","is",null),
    supabase.from("program_skips").select("skipped_at").eq("training_program_activated_at",program.activated_at),
  ]);
  if(workouts.error)throw workouts.error;if(skips.error)throw skips.error;
  const completed=workouts.data||[],skipped=skips.data||[],progress=completed.length+skipped.length,next=plan.days[progress%plan.days.length];
  const scheduleDays=(program.schedule_days?.length?program.schedule_days:[1,3,5]) as number[];const iso=(date:Date)=>date.toISOString().slice(0,10);const inWeek=(value:string)=>{const date=new Date(value);return date>=monday&&date<weekEnd};const completedThisWeek=completed.filter(item=>inWeek(item.completed_at)).length;const skippedThisWeek=skipped.filter(item=>inWeek(item.skipped_at)).length;const elapsed=scheduleDays.filter(day=>day<=today.getDay()).length;const overdue=completedThisWeek+skippedThisWeek<elapsed;const nextWeekday=overdue?today.getDay():scheduleDays.find(day=>day>=today.getDay())??scheduleDays[0];const scheduled=new Date(today);let offset=(nextWeekday-today.getDay()+7)%7;if(!overdue&&offset===0&&completedThisWeek+skippedThisWeek>=elapsed)offset=7;scheduled.setDate(today.getDate()+offset);
  return {programName:plan.name,activatedAt:program.activated_at,day:next.day,dayCount:plan.days.length,name:next.name,focus:next.focus,items:next.exercises.map(item=>({exercise:exerciseCatalog.find(exercise=>exercise.id===item.exerciseId),targetSets:item.sets,targetReps:item.reps})).filter((item):item is TemplateExercise=>Boolean(item.exercise)),scheduleDays,scheduledDate:iso(scheduled),overdue,completedThisWeek,plannedThisWeek:scheduleDays.length};
}

export async function saveProgramSchedule(days:number[]){const {error}=await supabase.from("training_programs").update({schedule_days:days,updated_at:new Date().toISOString()}).eq("status","active");if(error)throw error}
export async function skipProgramSession(userId:string,session:ProgramSession){const {error}=await supabase.from("program_skips").insert({id:crypto.randomUUID(),user_id:userId,training_program_activated_at:session.activatedAt,program_day:session.day});if(error)throw error}
