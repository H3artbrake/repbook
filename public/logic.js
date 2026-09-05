export const uid = () => crypto.randomUUID();
export function category(e){
  if(e.category)return e.category;
  const s=(e.group+' '+e.name).toLowerCase();
  if(/core|abs|abdom|plank|crunch/.test(s))return 'Core';
  if(/quads|glutes|hamstring|calf|calves|squat|deadlift|leg|hip thrust/.test(s))return 'Lower body';
  if(/chest|back|lats|shoulder|biceps|triceps|curl|press|row|chin|pull-up|push-up/.test(s))return 'Upper body';
  return 'Other';
}
export function matchesFilter(exercises,name,query,type){
  return (!query||[name,...exercises.map(e=>e.name)].join(' ').toLowerCase().includes(query.toLowerCase()))&&(type==='all'||exercises.some(e=>category(e)===type));
}
export function progressModes(sessions, exerciseId) {
  const ordered=[...sessions].sort((a,b)=>b.date.localeCompare(a.date)||b.finishedAt.localeCompare(a.finishedAt));
  const modes=[];
  for(const session of ordered){
    const counts=new Map();
    for(const set of session.exercises.filter(e=>e.exerciseId===exerciseId).flatMap(completedSets)){
      const mode=set.weight===null?'bodyReps':set.mode==='assisted'?'assistance':set.mode==='added'?'added':'weight';
      counts.set(mode,(counts.get(mode)||0)+1);
    }
    for(const [mode] of [...counts].sort((a,b)=>b[1]-a[1]))if(!modes.includes(mode))modes.push(mode);
  }
  return modes;
}
export function completedSets(exercise) {
  return exercise.sets.filter(s => s.done && Number.isInteger(s.reps) && s.reps > 0);
}
export function lastExercise(sessions, id, excludeId) {
  return [...sessions].filter(s=>s.id!==excludeId).sort((a,b)=>b.date.localeCompare(a.date)||b.finishedAt.localeCompare(a.finishedAt))
    .flatMap(s=>s.exercises.filter(e=>e.exerciseId===id&&completedSets(e).length).map(e=>({...e,date:s.date}))).at(0);
}
export function setLabel(s) {
  const load = s.weight == null ? 'BW' : s.mode === 'assisted' ? `${s.weight} kg assist` : s.mode === 'added' ? `BW + ${s.weight} kg` : `${s.weight} kg`;
  return `${load} × ${s.reps}`;
}
export function hint(exercise, previous) {
  if (!previous) return 'Your first log sets the baseline. Choose your own comfortable starting point.';
  const sets=completedSets(previous);
  if (!sets.length) return '';
  const repeat=`Last time: ${sets.length} sets. Repeat that as a starting point.`;
  if (sets.length < 2) return `${repeat} More logged sets will make the hint more useful.`;
  const sameLoad=sets.every(s=>s.weight===sets[0].weight&&s.mode===sets[0].mode);
  if (!sameLoad) return `${repeat} Mixed loads last time; no automatic increase suggested.`;
  const top=sets.every(s=>s.reps>=exercise.repMax);
  if (!top) return `${repeat} If it feels manageable, work toward ${exercise.repMax} reps per set before adding load.`;
  const s=sets[0];
  if (s.weight===null) return `${repeat} All sets reached ${exercise.repMax} reps. You could try one extra rep per set.`;
  const next=Math.round((s.mode==='assisted'?Math.max(0,s.weight-exercise.increment):s.weight+exercise.increment)*100)/100;
  return `All ${sets.length} sets reached ${exercise.repMax}+ reps. Optional next step: ${s.mode==='assisted'?`${next} kg assistance`:`${s.mode==='added'?'BW + ':''}${next} kg`}, aiming for ${exercise.repMin}–${exercise.repMax} reps. Keep the same set count.`;
}
export function series(sessions, exerciseId, metric) {
  return [...sessions].sort((a,b)=>a.date.localeCompare(b.date)||a.finishedAt.localeCompare(b.finishedAt)).flatMap(session=>{
    const sets=session.exercises.filter(e=>e.exerciseId===exerciseId).flatMap(completedSets);
    if (!sets.length) return [];
    let filtered,value;
    if(metric==='reps') value=sets.reduce((n,s)=>n+s.reps,0);
    else if(metric==='bodyReps') {filtered=sets.filter(s=>s.weight===null); if(!filtered.length)return [];value=Math.max(...filtered.map(s=>s.reps));}
    else if(metric==='assistance') {filtered=sets.filter(s=>s.weight!==null&&s.mode==='assisted');if(!filtered.length)return [];value=Math.min(...filtered.map(s=>s.weight));}
    else {filtered=sets.filter(s=>s.weight!==null&&s.mode===(metric==='added'?'added':'weighted'));if(!filtered.length)return [];value=metric==='volume'?filtered.reduce((n,s)=>n+s.weight*s.reps,0):Math.max(...filtered.map(s=>s.weight));}
    return [{date:session.date,value,sessionId:session.id}];
  });
}
