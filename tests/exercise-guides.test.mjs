import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {exerciseCatalog} from '../lib/exercise-catalog.ts';
import {additionalExerciseGuides} from '../lib/exercise-guide-library.ts';

const source=readFileSync(new URL('../lib/exercise-guides.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(code,{exports,require:id=>{
 assert.equal(id,'./exercise-guide-library');return {additionalExerciseGuides};
}});
const {getExerciseGuide,exerciseGuides}=exports;

test('every shared library exercise has a complete explicit technique guide',()=>{
 assert.equal(new Set(exerciseCatalog.map(e=>e.id)).size,exerciseCatalog.length);
 assert.equal(Object.keys(exerciseGuides).length,exerciseCatalog.length);
 for(const exercise of exerciseCatalog){
  const guide=getExerciseGuide(exercise);
  assert.ok(guide,`Missing guide: ${exercise.id}`);
  assert.ok(guide.summary.trim().length>20,exercise.id);
  for(const [key,min] of Object.entries({primary:1,secondary:1,setup:2,steps:3,cues:2,mistakes:2,substitutions:2})){
   assert.ok(Array.isArray(guide[key])&&guide[key].length>=min,`${exercise.id}: ${key}`);
   assert.ok(guide[key].every(s=>typeof s==='string'&&s.trim()),`${exercise.id}: blank ${key}`);
  }
  assert.doesNotMatch(JSON.stringify(guide),/Another .* exercise using available equipment|Set the equipment to a comfortable position and choose a manageable starting load/);
  if(guide.image)assert.ok(existsSync(new URL(`../public/${guide.image.replace(/^\.\//,'')}`,import.meta.url)),`Missing image: ${exercise.id}`);
 }
});

test('unknown exercises do not masquerade as having completed guides',()=>{
 assert.equal(getExerciseGuide({id:'unknown-custom-exercise'}),undefined);
});

test('new shared entries have variation-specific cues and stable IDs',()=>{
 const row=exerciseCatalog.find(e=>e.id==='single-arm-cable-lat-row');
 const lunge=exerciseCatalog.find(e=>e.id==='smith-reverse-lunge');
 assert.equal(row.equipment,'Cable');assert.equal(lunge.equipment,'Smith machine');
 assert.match(getExerciseGuide(row).steps.join(' '),/same-side hip/);
 assert.match(getExerciseGuide(lunge).setup.join(' '),/safeties/);
 assert.match(getExerciseGuide(lunge).steps.join(' '),/step one foot backwards/);
});

test('power, static holds and cardio are not given generic lifting instructions',()=>{
 const guide=id=>getExerciseGuide(exerciseCatalog.find(e=>e.id===id));
 assert.match(guide('trap-bar-jump').steps.join(' '),/reset fully|Reset fully/i);
 assert.match(guide('countermovement-jump').steps.join(' '),/Land softly/);
 assert.match(guide('plank').steps.join(' '),/Breathe steadily/);
 assert.match(guide('rowing-machine').steps.join(' '),/legs, then open the hips/);
 assert.match(guide('treadmill-run').steps.join(' '),/stop the belt before stepping off/);
});
