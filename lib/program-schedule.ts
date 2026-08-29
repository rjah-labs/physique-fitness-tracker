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
};

export async function loadNextProgramSession():Promise<ProgramSession|null>{
  const {data:program,error}=await supabase.from("training_programs").select("plan,activated_at").eq("status","active").maybeSingle();
  if(error)throw error;
  if(!program)return null;
  const plan=program.plan as ProgramPlan;
  if(!plan.days?.length)return null;
  const {count,error:countError}=await supabase.from("workouts").select("id",{count:"exact",head:true}).eq("training_program_activated_at",program.activated_at).not("program_day","is",null).not("completed_at","is",null);
  if(countError)throw countError;
  const next=plan.days[(count||0)%plan.days.length];
  return {programName:plan.name,activatedAt:program.activated_at,day:next.day,dayCount:plan.days.length,name:next.name,focus:next.focus,items:next.exercises.map(item=>({exercise:exerciseCatalog.find(exercise=>exercise.id===item.exerciseId),targetSets:item.sets,targetReps:item.reps})).filter((item):item is TemplateExercise=>Boolean(item.exercise))};
}
