import assert from "node:assert/strict";
import test from "node:test";
import {calendarDate,nextScheduledDate,weekBounds} from "../lib/program-calendar.ts";
import {exerciseCatalog} from "../lib/exercise-catalog.ts";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as calendar from "../lib/program-calendar.ts";

function loadModule(path,dependencies){
 const source=readFileSync(new URL(path,import.meta.url),"utf8");
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:id=>dependencies[id],Date,Intl,Error});return exports;
}

test("Wednesday start preserves training and rest order across Sunday",()=>{
 const dates=Array.from({length:7},(_,i)=>nextScheduledDate("2026-09-16",[0,1,3,4,5],i));
 assert.deepEqual(dates,["2026-09-16","2026-09-17","2026-09-18","2026-09-20","2026-09-21","2026-09-23","2026-09-24"]);
});
test("activation excludes earlier weekdays and respects future start dates",()=>{
 assert.equal(nextScheduledDate("2026-09-16",[1,3,5],0),"2026-09-16");
 assert.equal(nextScheduledDate("2026-09-19",[1,3,5],0),"2026-09-21");
});
test("calendar conversion respects Brisbane rather than UTC midnight",()=>{
 assert.equal(calendarDate(new Date("2026-09-15T16:00:00Z"),"Australia/Brisbane"),"2026-09-16");
 assert.deepEqual(weekBounds("2026-09-20"),{start:"2026-09-14",end:"2026-09-21"});
});
test("schedule rejects invalid inputs and tolerates unordered duplicate days",()=>{
 assert.throws(()=>nextScheduledDate("2026-09-16",[],0));
 assert.throws(()=>nextScheduledDate("2026-09-16",[3],-1));
 assert.equal(nextScheduledDate("2026-09-16",[5,3,3,1],1),"2026-09-18");
});
test("catalog IDs stay unique and power variants have explicit tracking",()=>{
 assert.equal(new Set(exerciseCatalog.map(item=>item.id)).size,exerciseCatalog.length);
 for(const id of ["countermovement-jump","box-jump","trap-bar-jump","light-explosive-pull"]){
  const item=exerciseCatalog.find(item=>item.id===id);
  assert.ok(item);assert.equal(item.intent,"power");assert.equal(item.restSeconds,180);
  assert.equal(item.tracking,id==="countermovement-jump"||id==="box-jump"?"reps":"weight_reps");
 }
});

test("power progression never suggests extra reps, tempo or load",()=>{
 const {progressionSuggestion}=loadModule("../lib/workout-repository.ts",{"./supabase":{supabase:{}},"./exercise-catalog":{exerciseCatalog}});
 const exercise=exerciseCatalog.find(item=>item.id==="trap-bar-jump");
 const result=progressionSuggestion({exercise,targetSets:4,targetReps:"3",sets:[],previousSets:Array.from({length:4},()=>({weight:20,reps:3}))});
 assert.equal(result.title,"Quality and speed first");assert.equal(result.suggestedWeight,undefined);
});

test("program loader retains custom rest, RIR and every exercise",async()=>{
 const program={activated_at:"2026-09-16T00:00:00Z",schedule_days:[0,1,3,4,5],plan:{name:"Test",startDate:"2026-09-16",timeZone:"Australia/Brisbane",days:[{day:1,name:"Lower",focus:"Glutes",exercises:[{exerciseId:"barbell-hip-thrust",name:"Hip thrust",sets:4,reps:"6–10",restSeconds:240,rir:"3",notes:"Controlled ROM"}]}]}};
 const supabase={from(table){const result={data:table==="training_programs"?program:[],error:null};const chain={select(){return chain},eq(){return chain},not(){return chain},maybeSingle(){return Promise.resolve(result)},then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}};return chain}};
 const {loadNextProgramSession}=loadModule("../lib/program-schedule.ts",{"./supabase":{supabase},"./exercise-catalog":{exerciseCatalog},"./program-calendar":calendar});
 const session=await loadNextProgramSession();assert.equal(session.day,1);assert.equal(session.scheduledDate,"2026-09-16");assert.equal(session.items.length,1);assert.equal(session.items[0].exercise.restSeconds,240);assert.match(session.items[0].exercise.coachingNotes,/RIR: 3/);
 program.plan.days[0].exercises[0].exerciseId="missing-id";
 await assert.rejects(loadNextProgramSession(),/Exercise library update required/);
});
