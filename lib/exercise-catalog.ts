export type MuscleGroup="Glutes"|"Legs"|"Back"|"Chest"|"Shoulders"|"Arms"|"Core"|"Cardio";
export type TrackingType="weight_reps"|"reps"|"duration"|"distance";
export type Exercise={id:string;name:string;group:MuscleGroup;equipment:string;restSeconds:number;tracking:TrackingType;aliases?:string[]};

export const muscleIcons:Record<MuscleGroup,string>={Glutes:"🍑",Legs:"🦵",Back:"🦅",Chest:"🫀",Shoulders:"🏹",Arms:"💪",Core:"⚡",Cardio:"🫁"};
const groups:Record<MuscleGroup,string[]>={
Glutes:["Barbell hip thrust","Dumbbell hip thrust","Cable hip thrust","Glute bridge (weighted)","Single-leg glute bridge","Cable kickback","Donkey kick","Fire hydrant","Glute-biased back extension","Cable pull through","Cable abductor","Hip abduction machine","Banded lateral walk","Frog pump","Reverse hyperextension","Single-leg hip thrust"],
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
