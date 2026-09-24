export type MuscleGroup="Glutes"|"Legs"|"Back"|"Chest"|"Shoulders"|"Arms"|"Core"|"Cardio";
export type TrackingType="weight_reps"|"reps"|"duration"|"distance";
export type Exercise={id:string;name:string;group:MuscleGroup;equipment:string;restSeconds:number;tracking:TrackingType;intent?:"power"|"hypertrophy";coachingNotes?:string;aliases?:string[]};

export const muscleIcons:Record<MuscleGroup,string>={Glutes:"🍑",Legs:"🦵",Back:"🦅",Chest:"🫀",Shoulders:"🏹",Arms:"💪",Core:"⚡",Cardio:"🫁"};
const groups:Record<MuscleGroup,string[]>={
Glutes:["Barbell hip thrust","Dumbbell hip thrust","Cable hip thrust","Glute bridge (weighted)","Single-leg glute bridge","Glute-biased Bulgarian split squat","Cable kickback","Donkey kick","Fire hydrant","Glute-biased back extension","Cable pull through","Cable abductor","Hip abduction machine","Banded lateral walk","Frog pump","Reverse hyperextension","Single-leg hip thrust"],
Legs:["Back squat","Front squat","Goblet squat","Sumo squat","Hack squat","Pendulum squat","Belt squat","Leg press","Leg extension","Walking lunges","Reverse lunges","Bulgarian split squat","Step-ups","Romanian deadlift","Single-leg Romanian deadlift","Sumo deadlift","Conventional deadlift","Lying leg curl","Seated leg curl","Nordic hamstring curl","Good morning","Hip adduction machine","Standing calf raise","Seated calf raise","Single-leg calf raise"],
Back:["Chest-supported row","Barbell bent-over row","One-arm dumbbell row","Seated cable row","T-bar row","Machine row","Meadows row","Lat pulldown","Close-grip pulldown","Single-arm pulldown","Straight-arm pulldown","Pull-ups","Chin-ups","Assisted pull-ups","Inverted row","Face pulls","Rack pull","Barbell shrug"],
Chest:["Barbell bench press","Dumbbell bench press","Incline barbell bench press","Incline dumbbell press","Decline bench press","Machine chest press","Smith machine bench press","Cable chest fly","Low-to-high cable fly","High-to-low cable fly","Pec deck","Dumbbell fly","Push-ups","Deficit push-ups","Cable crossover","Chest dips"],
Shoulders:["Barbell overhead press","Dumbbell shoulder press","Machine shoulder press","Arnold press","Landmine press","Lateral raise","Cable lateral raise","Machine lateral raise","Front raise","Rear delt fly","Reverse pec deck","Upright row","Lu raise"],
Arms:["Barbell bicep curl","EZ-bar curl","Dumbbell bicep curl","Alternating dumbbell curl","Hammer curl","Incline dumbbell curl","Preacher curl","Cable bicep curl","Bayesian cable curl","Concentration curl","Tricep pushdown","Rope tricep pushdown","Skull crushers","Overhead tricep extension","Cable overhead extension","Close-grip bench press","Tricep dips","Dumbbell kickback","Wrist curl","Reverse wrist curl"],
Core:["Plank","Side plank","Cable crunch","Machine crunch","Hanging leg raise","Captain's chair knee raise","Ab wheel rollout","Russian twist","Dead bug","Bird dog","Pallof press","Reverse crunch","Bicycle crunch","Suitcase carry"],
Cardio:["Outdoor running","Treadmill run","Stationary bike","Rowing machine","Stairmaster","Elliptical","Ski erg","Assault bike","Jump rope","HIIT sprints"]
};
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
const equipment=(name:string)=>name.match(/cable/i)?"Cable":name.match(/dumbbell/i)?"Dumbbell":name.match(/barbell|good morning/i)?"Barbell":name.match(/machine|pec deck|leg press|hack|pendulum|stairmaster|treadmill|bike|row|elliptical|ski erg/i)?"Machine":name.match(/band/i)?"Band":"Bodyweight";
export const exerciseCatalog:Exercise[]=Object.entries(groups).flatMap(([group,names])=>names.map(name=>({
  id:slug(name),name,group:group as MuscleGroup,equipment:equipment(name),
  restSeconds:group==="Cardio"?0:/deadlift|squat|bench press|pull-ups|overhead press/i.test(name)?120:90,
  tracking:group==="Cardio"?(name==="Jump rope"?"duration":"distance"):/plank|carry/i.test(name)?"duration":/push-ups|pull-ups|chin-ups|dip|donkey|hydrant|dead bug|bird dog/i.test(name)?"reps":"weight_reps",
  aliases:name==="Romanian deadlift"?["RDL"]:name==="Barbell bench press"?["Bench"]:undefined
})));

export const starterTemplates=[
 {name:"Lower Body — Glute Focus",exerciseIds:["barbell-hip-thrust","romanian-deadlift","bulgarian-split-squat","cable-kickback","hip-abduction-machine"]},
 {name:"Upper Body — Push",exerciseIds:["barbell-bench-press","incline-dumbbell-press","dumbbell-shoulder-press","lateral-raise","tricep-pushdown"]},
 {name:"Upper Body — Pull",exerciseIds:["lat-pulldown","chest-supported-row","one-arm-dumbbell-row","face-pulls","hammer-curl"]},
 {name:"Full Body",exerciseIds:["back-squat","barbell-bench-press","seated-cable-row","romanian-deadlift","plank"]}
];

// Variations referenced by imported hypertrophy programs must resolve before a session can load.
exerciseCatalog.push(
  {id:"single-arm-cable-lat-row",name:"Single-arm cable lat row",group:"Back",equipment:"Cable",restSeconds:120,tracking:"weight_reps",intent:"hypertrophy",aliases:["Single arm cable row","Cable lat row"]},
  {id:"smith-reverse-lunge",name:"Smith reverse lunge",group:"Legs",equipment:"Smith machine",restSeconds:150,tracking:"weight_reps",intent:"hypertrophy",aliases:["Smith machine reverse lunge"]},
  {"id":"neutral-grip-lat-pulldown","name":"Neutral-grip lat pulldown","group":"Back","equipment":"Cable","restSeconds":180,"tracking":"weight_reps"},
  {"id":"machine-high-row","name":"Machine high row","group":"Back","equipment":"Machine","restSeconds":150,"tracking":"weight_reps"},
  {"id":"machine-chest-supported-row","name":"Machine chest-supported row","group":"Back","equipment":"Machine","restSeconds":150,"tracking":"weight_reps"},
  {"id":"low-incline-dumbbell-press","name":"Low-incline dumbbell press","group":"Chest","equipment":"Dumbbell","restSeconds":180,"tracking":"weight_reps"},
  {"id":"glute-biased-smith-split-squat","name":"Glute-biased Smith split squat","group":"Glutes","equipment":"Smith machine","restSeconds":150,"tracking":"weight_reps"},
  {"id":"glute-biased-reverse-lunge","name":"Glute-biased reverse lunge","group":"Glutes","equipment":"Dumbbell","restSeconds":150,"tracking":"weight_reps"},
  {"id":"countermovement-jump","name":"Countermovement jump","group":"Legs","equipment":"Bodyweight","restSeconds":180,"tracking":"reps"},
  {"id":"trap-bar-jump","name":"Trap-bar jump","group":"Legs","equipment":"Trap bar","restSeconds":180,"tracking":"weight_reps"}
);

for (const id of ["countermovement-jump","trap-bar-jump"]) {
 const item=exerciseCatalog.find(exercise=>exercise.id===id);if(item)item.intent="power";
}

// Names alone cannot infer equipment: e.g. a leg curl is not bodyweight and
// a barbell row is not a rowing machine. Keep library guide headers accurate.
const equipmentOverrides:Record<string,string>={
 "glute-bridge-weighted":"Barbell / Dumbbell", "glute-biased-bulgarian-split-squat":"Dumbbell / Bench",
 "glute-biased-back-extension":"Back extension bench", "reverse-hyperextension":"Machine",
 "single-leg-hip-thrust":"Bench", "back-squat":"Barbell", "front-squat":"Barbell",
 "goblet-squat":"Dumbbell / Kettlebell", "sumo-squat":"Dumbbell / Kettlebell", "belt-squat":"Machine",
 "leg-extension":"Machine", "walking-lunges":"Bodyweight / Dumbbell", "reverse-lunges":"Bodyweight / Dumbbell",
 "bulgarian-split-squat":"Bodyweight / Dumbbell / Bench", "step-ups":"Step / Dumbbell",
 "romanian-deadlift":"Barbell", "single-leg-romanian-deadlift":"Dumbbell", "sumo-deadlift":"Barbell",
 "conventional-deadlift":"Barbell", "lying-leg-curl":"Machine", "seated-leg-curl":"Machine",
 "nordic-hamstring-curl":"Ankle anchor / Pad", "standing-calf-raise":"Machine / Dumbbell",
 "seated-calf-raise":"Machine", "single-leg-calf-raise":"Step / Dumbbell", "t-bar-row":"Landmine / Machine",
 "meadows-row":"Landmine", "lat-pulldown":"Cable", "close-grip-pulldown":"Cable",
 "single-arm-pulldown":"Cable", "straight-arm-pulldown":"Cable", "assisted-pull-ups":"Machine / Band",
 "inverted-row":"Fixed bar", "face-pulls":"Cable", "rack-pull":"Barbell / Rack",
 "decline-bench-press":"Barbell / Bench", "smith-machine-bench-press":"Smith machine",
 "deficit-push-ups":"Push-up handles", "chest-dips":"Parallel bars", "arnold-press":"Dumbbell",
 "landmine-press":"Landmine", "lateral-raise":"Dumbbell", "front-raise":"Dumbbell",
 "rear-delt-fly":"Dumbbell / Cable", "upright-row":"Barbell / Cable", "lu-raise":"Weight plates",
 "ez-bar-curl":"EZ-bar", "alternating-dumbbell-curl":"Dumbbell", "hammer-curl":"Dumbbell",
 "preacher-curl":"Preacher bench / EZ-bar / Machine", "concentration-curl":"Dumbbell",
 "tricep-pushdown":"Cable", "rope-tricep-pushdown":"Cable", "skull-crushers":"EZ-bar / Dumbbell",
 "overhead-tricep-extension":"Dumbbell", "close-grip-bench-press":"Barbell / Bench",
 "tricep-dips":"Parallel bars", "wrist-curl":"Barbell / Dumbbell", "reverse-wrist-curl":"Barbell / Dumbbell",
 "hanging-leg-raise":"Pull-up bar", "captain-s-chair-knee-raise":"Captain’s chair",
 "ab-wheel-rollout":"Ab wheel", "russian-twist":"Bodyweight / Weight plate", "pallof-press":"Cable / Band",
 "suitcase-carry":"Dumbbell / Kettlebell", "assault-bike":"Air bike", "jump-rope":"Skipping rope"
};
for(const item of exerciseCatalog){if(equipmentOverrides[item.id])item.equipment=equipmentOverrides[item.id];}
