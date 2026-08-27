import {supabase} from "./supabase";
import {exerciseCatalog,type Exercise} from "./exercise-catalog";

export type LoggedSet={weight:number;reps:number;done:boolean};
export type ActiveExercise={exercise:Exercise;sets:LoggedSet[]};
export type WorkoutHistory={id:string;name:string;startedAt:string;completedAt:string;setCount:number;volume:number;exerciseNames:string[]};
export type TemplateExercise={exercise:Exercise;targetSets:number;targetReps:string};
export type WorkoutTemplate={id:string;name:string;notes:string;items:TemplateExercise[];createdAt:string;updatedAt:string};

export const workoutRepository={
 async finish(userId:string,name:string,items:ActiveExercise[],startedAt:string){
  const workoutId=crypto.randomUUID();
  const {error:wErr}=await supabase.from("workouts").insert({id:workoutId,user_id:userId,name:name.trim()||"Workout",started_at:startedAt,completed_at:new Date().toISOString()});if(wErr)throw wErr;
  for(let i=0;i<items.length;i++){const item=items[i],exerciseId=crypto.randomUUID();
   const {error:eErr}=await supabase.from("workout_exercises").insert({id:exerciseId,user_id:userId,workout_id:workoutId,exercise_id:item.exercise.id,exercise_name:item.exercise.name,sort_order:i});if(eErr)throw eErr;
   const rows=item.sets.filter(s=>s.done).map((set,index)=>({user_id:userId,workout_id:workoutId,workout_exercise_id:exerciseId,set_number:index+1,weight_kg:set.weight,reps:set.reps,completed:true}));
   if(rows.length){const {error:sErr}=await supabase.from("workout_sets").insert(rows);if(sErr)throw sErr}
  }
 },
 async history():Promise<WorkoutHistory[]>{
  const {data,error}=await supabase.from("workouts").select("id,name,started_at,completed_at,workout_exercises(exercise_name,workout_sets(weight_kg,reps,completed))").not("completed_at","is",null).order("started_at",{ascending:false}).limit(30);if(error)throw error;
  return (data||[]).map((w:any)=>{const sets=w.workout_exercises.flatMap((e:any)=>e.workout_sets||[]).filter((s:any)=>s.completed);return{id:w.id,name:w.name,startedAt:w.started_at,completedAt:w.completed_at,setCount:sets.length,volume:sets.reduce((n:number,s:any)=>n+Number(s.weight_kg||0)*Number(s.reps||0),0),exerciseNames:w.workout_exercises.map((e:any)=>e.exercise_name)}})
 },
 async templates():Promise<WorkoutTemplate[]>{
  const {data,error}=await supabase.from("workout_templates").select("id,name,notes,created_at,updated_at,workout_template_exercises(exercise_id,sort_order,target_sets,target_reps)").order("updated_at",{ascending:false});if(error)throw error;
  return (data||[]).map((row:any)=>({id:row.id,name:row.name,notes:row.notes||"",createdAt:row.created_at,updatedAt:row.updated_at,items:(row.workout_template_exercises||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((item:any)=>({exercise:exerciseCatalog.find(e=>e.id===item.exercise_id),targetSets:item.target_sets,targetReps:item.target_reps})).filter((item:any)=>item.exercise)}));
 },
 async saveTemplate(userId:string,template:{id?:string;name:string;notes?:string;items:TemplateExercise[]}){
  const id=template.id||crypto.randomUUID(),now=new Date().toISOString();
  const {error:templateError}=await supabase.from("workout_templates").upsert({id,user_id:userId,name:template.name.trim(),notes:template.notes?.trim()||null,updated_at:now},{onConflict:"id"});if(templateError)throw templateError;
  if(template.id){const {error}=await supabase.from("workout_template_exercises").delete().eq("template_id",id);if(error)throw error}
  const rows=template.items.map((item,index)=>({user_id:userId,template_id:id,exercise_id:item.exercise.id,sort_order:index,target_sets:item.targetSets,target_reps:item.targetReps.trim()||"8-12"}));
  if(rows.length){const {error}=await supabase.from("workout_template_exercises").insert(rows);if(error)throw error}
  return id;
 },
 async deleteTemplate(id:string){const {error}=await supabase.from("workout_templates").delete().eq("id",id);if(error)throw error},
 exercise(id:string){return exerciseCatalog.find(e=>e.id===id)}
};
