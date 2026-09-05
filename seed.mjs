export function seed() {
  const rows = [
    ['squat','Back squat','Quads / glutes',false,2.5],
    ['rdl','Romanian deadlift','Hamstrings / glutes',false,2.5],
    ['bench','Barbell bench press','Chest',false,2.5],
    ['pullup','Pull-ups','Back / lats',true,2.5],
    ['lateral','Dumbbell lateral raises','Shoulders',false,1],
    ['curl','Dumbbell curls','Biceps',false,1],
    ['triceps','Overhead DB triceps extension','Triceps',false,1],
    ['split','Bulgarian split squat','Quads / glutes',false,1],
    ['hip','Hip thrust','Hamstrings / glutes',false,2.5],
    ['incline','Incline dumbbell bench press','Chest',false,1],
    ['row','Barbell bent-over row','Back / lats',false,2.5],
    ['press','Standing overhead press','Shoulders',false,2.5],
    ['hammer','Hammer curls','Biceps',false,1],
    ['pushup','Close-grip push-ups','Triceps',true,2.5],
    ['front','Front squat','Quads / glutes',false,2.5],
    ['single','Single-leg Romanian deadlift','Hamstrings / glutes',false,1],
    ['chin','Chin-ups','Back / lats',true,2.5],
    ['onearm','One-arm dumbbell row','Upper back',false,1],
    ['rear','Rear-delt dumbbell fly','Shoulders',false,1],
    ['skull','Lying DB skull crushers','Triceps',false,1],
    ['bridge','Glute bridge','Hamstrings / glutes',false,2.5],
    ['kickback','Cable glute kickback','Glutes',false,1],
    ['abduction','Standing cable hip abduction','Glutes',false,1]
  ];
  return {
    exercises: rows.map(([id,name,group,bodyweight,increment]) => ({id,name,group,bodyweight,increment,repMin:8,repMax:12})),
    starterVersion: 101,
    templates: [
      {id:'day1',name:'Day 1',exerciseIds:['squat','rdl','bench','pullup','lateral','curl','triceps']},
      {id:'day2',name:'Day 2',exerciseIds:['split','hip','incline','row','press','hammer','pushup']},
      {id:'day3',name:'Day 3',exerciseIds:['front','single','bench','chin','onearm','rear','skull']},
      {id:'glute-focus',name:'Glute Focus',exerciseIds:['hip','split','kickback','abduction']}
    ].map(t=>({...t,recommendations:Object.fromEntries(t.exerciseIds.map(id=>[id,recommendation(id)]))})),
    sessions: [], active: null, settings: {hints:true}
  };
}

function recommendation(id) {
  const high={lateral:12,rear:12,kickback:12,abduction:15,triceps:10,skull:10};
  return {sets:['lateral','rear','curl','hammer','triceps','skull','kickback','abduction'].includes(id)?2:3,reps:high[id]||8};
}

// Add starter content once, preserving logs, active sessions and existing edits.
export function upgradeStarters(state) {
  if(state.starterVersion>=101)return false;
  const defaults=seed();
  for(const t of state.templates){
    const original=defaults.templates.find(x=>x.id===t.id&&x.id!=='glute-focus');
    if(!original)continue;
    t.recommendations??={};
    for(const id of t.exerciseIds){
      const e=state.exercises.find(e=>e.id===id),base=defaults.exercises.find(e=>e.id===id);
      if(e&&base&&e.name===base.name&&original.exerciseIds.includes(id))t.recommendations[id]??=recommendation(id);
    }
  }
  const glutes=structuredClone(defaults.templates.find(t=>t.id==='glute-focus'));
  const uniqueId=(id,items)=>{let result=id;while(items.some(x=>x.id===result))result+='-new';return result;};
  glutes.recommendations={};
  glutes.exerciseIds=glutes.exerciseIds.map(id=>{
    const base=defaults.exercises.find(e=>e.id===id);
    let match=state.exercises.find(e=>e.name===base.name);
    if(!match){match={...base,id:uniqueId(id,state.exercises)};state.exercises.push(match);}
    glutes.recommendations[match.id]=recommendation(id);return match.id;
  });
  glutes.id=uniqueId(glutes.id,state.templates);
  state.templates.push(glutes);
  state.starterVersion=101;
  return true;
}
