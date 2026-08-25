import {supabase} from "./supabase";
import {exerciseCatalog,type Exercise} from "./exercise-catalog";
export type LoggedSet={weight:number;reps:number;done:boolean};
export type ActiveExercise={exercise:Exercise;sets:LoggedSet[]};
export type WorkoutHistory={id:string;name:string;startedAt:string;completedAt:string;setCount:number;volume:number;exerciseNames:string[]};

export const workoutRepository={
 async finish(userId:string,name:string,items:ActiveExercise[],startedAt:string){
  const workoutId=crypto.randomUUID();
  const {error:wErr}=await supabase.from("workouts").insert({id:workoutId,user_id:userId,name,started_at:startedAt,completed_at:new Date().toISOString()});if(wErr)throw wErr;
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
 exercise(id:string){return exerciseCatalog.find(e=>e.id===id)}
};
