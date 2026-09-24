import {supabase} from './supabase';
import {planner,todayDate,cardFromRow} from './workout-planner';
import type {TemplateExercise} from './workout-repository';
export type ProgramSession={name:string;focus:string;items:TemplateExercise[];day:number;dayCount:number;activatedAt:string;cardId:string;calendarEntryId:string;scheduledDate:string};
/** Recommend the explicitly planned session for today; history count never selects a day. */
export async function loadNextProgramSession():Promise<ProgramSession|null>{
 await planner.ensure();
 const today=todayDate();
 const entries=await planner.entries(today,today);
 const entry=entries.find(e=>e.kind==='workout'&&e.status==='planned');
 if(!entry)return null;
 const {data,error}=await supabase.from('workout_cards').select('*').eq('id',entry.card_id).maybeSingle();
 if(error)throw error;if(!data)return null;
 const card=cardFromRow(data);
 return{name:card.name,focus:card.notes,items:card.items,day:card.programDay||0,dayCount:0,activatedAt:card.programActivatedAt||'',cardId:card.id,calendarEntryId:entry.id,scheduledDate:today};
}
