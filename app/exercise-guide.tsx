"use client";

import type {Exercise} from "../lib/exercise-catalog";
import {getExerciseGuide} from "../lib/exercise-guides";

function GuideContent({exercise}:{exercise:Exercise}){
 const guide=getExerciseGuide(exercise);
 if(!guide)return <p className="guide-summary">A technique guide has not been added for this custom exercise yet.</p>;
 return <div className="exercise-guide-content">
  {guide.image&&<figure><img src={guide.image} alt={`Two-position technique illustration for ${exercise.name}`}/><figcaption>Start position · working position</figcaption></figure>}
  <p className="guide-summary">{guide.summary}</p>
  <div className="muscle-map"><span><small>Primary</small><strong>{guide.primary.join(" · ")}</strong></span><span><small>Also working</small><strong>{guide.secondary.join(" · ")}</strong></span></div>
  <section><h3>Set up</h3><ol>{guide.setup.map(item=><li key={item}>{item}</li>)}</ol></section>
  <section><h3>Perform the movement</h3><ol>{guide.steps.map(item=><li key={item}>{item}</li>)}</ol></section>
  <section className="cue-section"><h3>Useful cues</h3><div>{guide.cues.map(item=><span key={item}>{item}</span>)}</div></section>
  <section><h3>Common mistakes</h3><ul>{guide.mistakes.map(item=><li key={item}>{item}</li>)}</ul></section>
  <section><h3>Substitutions</h3><p>{guide.substitutions.join(" · ")}</p></section>
  <p className="guide-boundary">Use a load and range you can control. Stop if the movement causes pain, and seek appropriately qualified guidance when needed.</p>
 </div>
}

export function ExerciseGuideInline({exercise}:{exercise:Exercise}){return <details className="exercise-guide-inline"><summary><span>◎</span><div><strong>Exercise guide</strong><small>Technique, muscles and common mistakes</small></div><b>＋</b></summary><GuideContent exercise={exercise}/></details>}

export function ExerciseGuideSheet({exercise,onClose,onStart}:{exercise:Exercise;onClose:()=>void;onStart?:()=>void}){return <div className="sheet-backdrop exercise-guide-backdrop" onClick={onClose}><section className="sheet exercise-guide-sheet" role="dialog" aria-modal="true" aria-labelledby="exercise-guide-title" onClick={event=>event.stopPropagation()}><header className="sheet-head"><div><p className="eyebrow">EXERCISE GUIDE</p><h2 id="exercise-guide-title">{exercise.name}</h2><p>{exercise.equipment} · {exercise.group}</p></div><button onClick={onClose} aria-label="Close exercise guide">×</button></header><div className="exercise-guide-scroll"><GuideContent exercise={exercise}/></div><footer>{onStart&&<button className="primary" onClick={onStart}>Start this exercise</button>}<button className="secondary" onClick={onClose}>Close guide</button></footer></section></div>}
