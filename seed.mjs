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
    ['bridge','Glute bridge','Hamstrings / glutes',false,2.5]
  ];
  return {
    exercises: rows.map(([id,name,group,bodyweight,increment]) => ({id,name,group,bodyweight,increment,repMin:8,repMax:12})),
    templates: [
      {id:'day1',name:'Day 1',exerciseIds:['squat','rdl','bench','pullup','lateral','curl','triceps']},
      {id:'day2',name:'Day 2',exerciseIds:['split','hip','incline','row','press','hammer','pushup']},
      {id:'day3',name:'Day 3',exerciseIds:['front','single','bench','chin','onearm','rear','skull']}
    ],
    sessions: [], active: null, settings: {hints:true}
  };
}
