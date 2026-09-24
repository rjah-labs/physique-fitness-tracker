import {supabase} from "./supabase";
import {cardFromRow,planner} from "./workout-planner";
import {exerciseCatalog,type Exercise} from "./exercise-catalog";

export type LoggedSet={weight:number|null;reps:number|null;done:boolean};
export type ActiveExercise={exercise:Exercise;sets:LoggedSet[];notes?:string;previousSets?:Array<{weight:number;reps:number}>;targetSets?:number;targetReps?:string};
export type ActiveWorkoutDraft={id?:string;cardId?:string;calendarEntryId?:string;name:string;startedAt:string;updatedAt?:string;items:ActiveExercise[];programDay?:number;programActivatedAt?:string};
export type WorkoutHistoryExercise={exerciseId:string;name:string;notes:string;sets:Array<{setNumber:number;weight:number;reps:number;volume:number}>};
export type WorkoutHistory={id:string;name:string;startedAt:string;completedAt:string;setCount:number;volume:number;exerciseNames:string[];exercises:WorkoutHistoryExercise[]};
export type TemplateExercise={exercise:Exercise;targetSets:number;targetReps:string};
export type WorkoutTemplate={programDay?:number;programActivatedAt?:string;id:string;name:string;notes:string;items:TemplateExercise[];createdAt:string;updatedAt:string};

export type ProgressionSuggestion={kind:"baseline"|"build-reps"|"add-load"|"recover";title:string;detail:string;suggestedWeight?:number};

export function progressionSuggestion(item:ActiveExercise):ProgressionSuggestion{
 if(item.exercise.intent==="power")return{kind:"baseline",title:"Quality and speed first",detail:"Keep the prescribed reps and full rest. Stop if speed or landing quality falls; do not chase fatigue."};
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
 async loadDraft(userId:string):Promise<ActiveWorkoutDraft|null>{const {data,error}=await supabase.from("active_workout_drafts").select("session").eq("user_id",userId).maybeSingle();if(error)throw error;return data?.session as ActiveWorkoutDraft||null},
 async saveDraft(userId:string,session:ActiveWorkoutDraft){void userId;const {error}=await supabase.rpc("save_workout_draft",{p_session:session});if(error)throw error},
 async deleteDraft(userId:string){const {error}=await supabase.from("active_workout_drafts").delete().eq("user_id",userId);if(error)throw error},
 async finish(userId:string,session:ActiveWorkoutDraft){void userId;const {error}=await supabase.rpc("finish_workout_session",{p_session:session});if(error)throw error},
 async history():Promise<WorkoutHistory[]>{
  const {data,error}=await supabase.from("workouts").select("id,name,started_at,completed_at,workout_exercises(exercise_id,exercise_name,sort_order,notes,workout_sets(set_number,weight_kg,reps,completed))").not("completed_at","is",null).order("started_at",{ascending:false}).limit(30);if(error)throw error;
  return (data||[]).map((w:any)=>{const exercises=(w.workout_exercises||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((exercise:any)=>({exerciseId:exercise.exercise_id,name:exercise.exercise_name,notes:exercise.notes||"",sets:(exercise.workout_sets||[]).filter((set:any)=>set.completed).sort((a:any,b:any)=>a.set_number-b.set_number).map((set:any)=>{const weight=Number(set.weight_kg||0),reps=Number(set.reps||0);return{setNumber:Number(set.set_number),weight,reps,volume:weight*reps}})}));const sets=exercises.flatMap((exercise:WorkoutHistoryExercise)=>exercise.sets);return{id:w.id,name:w.name,startedAt:w.started_at,completedAt:w.completed_at,setCount:sets.length,volume:sets.reduce((n:number,set:{volume:number})=>n+set.volume,0),exerciseNames:exercises.map((exercise:WorkoutHistoryExercise)=>exercise.name),exercises}})
 },
 async templates():Promise<WorkoutTemplate[]>{
  await planner.ensure();
  // Bring manually saved legacy routines across once, keeping their IDs stable.
  const {data:legacy,error:legacyError}=await supabase.from("workout_templates").select("id,name,notes,created_at,updated_at,workout_template_exercises(exercise_id,sort_order,target_sets,target_reps)");if(legacyError)throw legacyError;
  if(legacy?.length){const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error("Sign in required");
   const rows=legacy.map((row:any)=>({id:row.id,user_id:auth.user!.id,name:row.name,notes:row.notes||"",source_key:`legacy:${row.id}`,created_at:row.created_at,updated_at:row.updated_at,items:(row.workout_template_exercises||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((item:any)=>({exercise:exerciseCatalog.find(e=>e.id===item.exercise_id),targetSets:item.target_sets,targetReps:item.target_reps})).filter((item:any)=>item.exercise)}));
   const {error}=await supabase.from("workout_cards").upsert(rows,{onConflict:"id",ignoreDuplicates:true});if(error)throw error;
  }
  const {data,error}=await supabase.from("workout_cards").select("*").eq("archived",false).order("created_at");if(error)throw error;return(data||[]).map(cardFromRow);
 },
 async saveTemplate(userId:string,template:{id?:string;name:string;notes?:string;items:TemplateExercise[]}){
  const id=template.id||crypto.randomUUID();const {error}=await supabase.from("workout_cards").upsert({id,user_id:userId,name:template.name.trim(),notes:template.notes?.trim()||"",items:template.items,updated_at:new Date().toISOString()},{onConflict:"id"});if(error)throw error;return id;
 },
 async deleteTemplate(id:string){const {data,error:check}=await supabase.from("workout_calendar").select("id").eq("card_id",id).eq("status","planned").limit(1);if(check)throw check;if(data?.length)throw new Error("Remove or replace this card’s planned calendar sessions before archiving it.");const {error}=await supabase.from("workout_cards").update({archived:true,updated_at:new Date().toISOString()}).eq("id",id);if(error)throw error},
 async previousSets(exerciseIds:string[]){const pairs=await Promise.all(exerciseIds.map(async id=>{const {data}=await supabase.from("workout_exercises").select("workout_sets(weight_kg,reps,completed),workouts!inner(completed_at)").eq("exercise_id",id).not("workouts.completed_at","is",null).order("completed_at",{referencedTable:"workouts",ascending:false}).limit(1).maybeSingle();const sets=((data as any)?.workout_sets||[]).filter((set:any)=>set.completed).map((set:any)=>({weight:Number(set.weight_kg||0),reps:Number(set.reps||0)}));return [id,sets] as const}));return Object.fromEntries(pairs) as Record<string,Array<{weight:number;reps:number}>>},
 exercise(id:string){return exerciseCatalog.find(e=>e.id===id)}
};
