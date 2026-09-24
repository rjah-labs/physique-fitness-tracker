import {supabase} from './supabase';
import {calendarDate} from './program-calendar';
import type {WorkoutTemplate,TemplateExercise} from './workout-repository';
export type CalendarEntry={id:string;scheduled_on:string;card_id:string|null;kind:'workout'|'rest';status:'planned'|'completed'|'skipped'|'moved';moved_to:string|null};
export function todayDate(){return calendarDate(new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone)}
export function addDays(date:string,days:number){const value=new Date(date+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10)}
export function monthDates(month:string){const first=month+'-01';const start=addDays(first,-((new Date(first+'T12:00:00Z').getUTCDay()+6)%7));return Array.from({length:42},(_,i)=>addDays(start,i))}
export function calendarStatus(entry:CalendarEntry,today:string){return entry.status==='planned'&&entry.kind==='workout'&&entry.scheduled_on<today?'missed':entry.kind==='rest'&&entry.status==='planned'?'rest':entry.status}
export function cardFromRow(row:any):WorkoutTemplate{return{id:row.id,name:row.name,notes:row.notes||'',items:row.items as TemplateExercise[],createdAt:row.created_at,updatedAt:row.updated_at,programDay:row.program_day,programActivatedAt:row.program_activated_at}}
export const planner={
 async ensure(){const {error}=await supabase.rpc('ensure_workout_cards');if(error)throw error},
 async entries(start:string,end:string):Promise<CalendarEntry[]>{const {data,error}=await supabase.from('workout_calendar').select('*').gte('scheduled_on',start).lte('scheduled_on',end).order('scheduled_on');if(error)throw error;return data||[]},
 async plan(date:string,cardId:string|null,count=1,intervalWeeks=1):Promise<string>{const {data,error}=await supabase.rpc('plan_workout_recurrence',{p_date:date,p_card:cardId,p_count:count,p_interval_weeks:intervalWeeks});if(error)throw error;return data},
 async move(id:string,date:string){const {error}=await supabase.rpc('move_workout_day',{p_id:id,p_date:date});if(error)throw error},
 async skip(id:string){const {error}=await supabase.from('workout_calendar').update({status:'skipped',updated_at:new Date().toISOString()}).eq('id',id).eq('status','planned');if(error)throw error},
 async clear(id:string){const {error}=await supabase.from('workout_calendar').delete().eq('id',id).neq('status','completed');if(error)throw error}
};
