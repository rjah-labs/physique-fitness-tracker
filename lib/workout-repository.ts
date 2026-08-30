import {supabase} from "./supabase";
import {exerciseCatalog,type Exercise} from "./exercise-catalog";

export type LoggedSet={weight:number;reps:number;done:boolean};
export type ActiveExercise={exercise:Exercise;sets:LoggedSet[];previousSets?:Array<{weight:number;reps:number}>;targetSets?:number;targetReps?:string};
export type WorkoutHistoryExercise={exerciseId:string;name:string;sets:Array<{setNumber:number;weight:number;reps:number;volume:number}>};
export type WorkoutHistory={id:string;name:string;startedAt:string;completedAt:string;setCount:number;volume:number;exerciseNames:string[];exercises:WorkoutHistoryExercise[]};
export type TemplateExercise={exercise:Exercise;targetSets:number;targetReps:string};
export type WorkoutTemplate={id:string;name:string;notes:string;items:TemplateExercise[];createdAt:string;updatedAt:string};

export type ProgressionSuggestion={kind:"baseline"|"build-reps"|"add-load"|"recover";title:string;detail:string;suggestedWeight?:number};

export function progressionSuggestion(item:ActiveExercise):ProgressionSuggestion{
 const previous=item.previousSets||[],targetSets=item.targetSets||item.sets.length;
 const repTargets=(item.targetReps||"").match(/\d+/g)?.map(Number)||[];
 const minimum=repTargets[0]||item.sets[0]?.reps||8,maximum=repTargets.at(-1)||minimum;
 if(!previous.length)return{kind:"baseline",title:"Establish your baseline",detail:`Choose a controlled load you can complete for ${targetSets} × ${item.targetReps||minimum}.`};
 const working=previous.filter(set=>set.weight>0),weight=working[0]?.weight||0;
 const allSetsCompleted=previous.length>=targetSets;
 const allAtMaximum=allSetsCompleted&&previous.slice(0,targetSets).every(set=>set.reps>=maximum);
 const allAtMinimum=allSetsCompleted&&previous.slice(0,targetSets).every(set=>set.reps>=minimum);
 if(allAtMaximum&&weight>0){const suggested=Math.round((weight+2.5)*2)/2;return{kind:"add-load",title:`Consider ${suggested} kg`,detail:`You reached the top of the ${item.targetReps||minimum} rep range last time. The suggested increase is optional.`,suggestedWeight:suggested}}
 if(allAtMaximum)return{kind:"build-reps",title:"Add a little difficulty",detail:"You reached the top of the rep range. Consider one extra rep, a slower tempo, or a small external load if appropriate."};
 if(allAtMinimum)return{kind:"build-reps",title:"Build reps before load",detail:`Repeat ${weight?`${weight} kg`:"the same load"} and work towards ${maximum} reps with controlled form.`};
 return{kind:"recover",title:"Consolidate this load",detail:`Repeat or reduce the load until you can complete ${targetSets} sets of at least ${minimum} controlled reps.`};
}

export const workoutRepository={
 async finish(userId:string,name:string,items:ActiveExercise[],startedAt:string,program?:{day:number;activatedAt:string}){
  const workoutId=crypto.randomUUID();
  const {error:wErr}=await supabase.from("workouts").insert({id:workoutId,user_id:userId,name:name.trim()||"Workout",started_at:startedAt,completed_at:new Date().toISOString(),program_day:program?.day||null,training_program_activated_at:program?.activatedAt||null});if(wErr)throw wErr;
  for(let i=0;i<items.length;i++){const item=items[i],exerciseId=crypto.randomUUID();
   const {error:eErr}=await supabase.from("workout_exercises").insert({id:exerciseId,user_id:userId,workout_id:workoutId,exercise_id:item.exercise.id,exercise_name:item.exercise.name,sort_order:i});if(eErr)throw eErr;
   const rows=item.sets.filter(s=>s.done).map((set,index)=>({user_id:userId,workout_id:workoutId,workout_exercise_id:exerciseId,set_number:index+1,weight_kg:set.weight,reps:set.reps,completed:true}));
   if(rows.length){const {error:sErr}=await supabase.from("workout_sets").insert(rows);if(sErr)throw sErr}
  }
 },
 async history():Promise<WorkoutHistory[]>{
  const {data,error}=await supabase.from("workouts").select("id,name,started_at,completed_at,workout_exercises(exercise_id,exercise_name,sort_order,workout_sets(set_number,weight_kg,reps,completed))").not("completed_at","is",null).order("started_at",{ascending:false}).limit(30);if(error)throw error;
  return (data||[]).map((w:any)=>{const exercises=(w.workout_exercises||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((exercise:any)=>({exerciseId:exercise.exercise_id,name:exercise.exercise_name,sets:(exercise.workout_sets||[]).filter((set:any)=>set.completed).sort((a:any,b:any)=>a.set_number-b.set_number).map((set:any)=>{const weight=Number(set.weight_kg||0),reps=Number(set.reps||0);return{setNumber:Number(set.set_number),weight,reps,volume:weight*reps}})}));const sets=exercises.flatMap((exercise:WorkoutHistoryExercise)=>exercise.sets);return{id:w.id,name:w.name,startedAt:w.started_at,completedAt:w.completed_at,setCount:sets.length,volume:sets.reduce((n:number,set:{volume:number})=>n+set.volume,0),exerciseNames:exercises.map((exercise:WorkoutHistoryExercise)=>exercise.name),exercises}})
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
 async previousSets(exerciseIds:string[]){const pairs=await Promise.all(exerciseIds.map(async id=>{const {data}=await supabase.from("workout_exercises").select("workout_sets(weight_kg,reps,completed),workouts!inner(completed_at)").eq("exercise_id",id).not("workouts.completed_at","is",null).order("completed_at",{referencedTable:"workouts",ascending:false}).limit(1).maybeSingle();const sets=((data as any)?.workout_sets||[]).filter((set:any)=>set.completed).map((set:any)=>({weight:Number(set.weight_kg||0),reps:Number(set.reps||0)}));return [id,sets] as const}));return Object.fromEntries(pairs) as Record<string,Array<{weight:number;reps:number}>>},
 exercise(id:string){return exerciseCatalog.find(e=>e.id===id)}
};
