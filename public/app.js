import {uid,completedSets,lastExercise,setLabel,hint,series,progressModes,category,matchesFilter} from './logic.js';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateLabel=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
const number=n=>new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(n);
let progressFilter='all',progressSearch='';
const filters={workouts:{q:'',type:'all'},history:{q:'',type:'all'},picker:{q:'',type:'all'},settings:{q:'',type:'all'}};
function filterBar(key,q='',type='all'){return '<div class="browse-filters"><label>Search<input type="search" data-search="'+key+'" value="'+esc(q)+'" placeholder="Search by name"></label><label>Body area<select data-category="'+key+'">'+['all','Upper body','Lower body','Core','Other'].map(c=>'<option value="'+c+'" '+(type===c?'selected':'')+'>'+ (c==='all'?'All areas':c)+'</option>').join('')+'</select></label></div>';}
function filterLists(){
  const f=filters[page];
  if(!f)return;
  let count=0;
  document.querySelectorAll('[data-browse-id]').forEach(el=>{
    const id=el.dataset.browseId;
    const item=page==='workouts'?state.templates.find(t=>t.id===id):page==='history'?state.sessions.find(t=>t.id===id):state.exercises.find(t=>t.id===id);
    const exercises=page==='workouts'?item.exerciseIds.map(id=>state.exercises.find(e=>e.id===id)):page==='history'?item.exercises.map(e=>state.exercises.find(x=>x.id===e.exerciseId)):[item];
    el.hidden=!matchesFilter(exercises,item.name||item.templateName,f.q,f.type);if(!el.hidden)count++;
  });
  const empty=$('#filter-empty');if(empty)empty.hidden=count>0;
}
function pickerOptions(){
  const select=$('#template-exercise')||$('#session-exercise');if(!select)return;
  const excluded=select.id==='template-exercise'?templateDraft.exerciseIds:currentSession().exercises.map(e=>e.exerciseId),f=filters.picker;
  select.innerHTML='<option value="">Choose an exercise…</option>'+state.exercises.filter(e=>!excluded.includes(e.id)&&matchesFilter([e],e.name,f.q,f.type)).map(e=>'<option value="'+e.id+'">'+esc(e.name)+'</option>').join('');
}
let state,user,revision=0,page='workouts',dirty=false,saving=false,saveTimer,saveError='',conflict=false,selectedExercise='',metric='weight',editingId=null,templateDraft=null,installPrompt=null;
const draftKey=()=>`repbook-draft-${user.id}`;
async function api(path,method='GET',data){
  let response;try{response=await fetch('/api'+path,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});}catch{throw new Error('Cannot reach your NAS. Changes stay on this device until it reconnects.');}
  const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'Request failed.'),{status:response.status});return result;
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function storeDraft(){try{localStorage.setItem(draftKey(),JSON.stringify({revision,state}));}catch{saveError='Device storage is unavailable. Keep this page open until changes save to your NAS.';}}
function changed(){dirty=true;storeDraft();clearTimeout(saveTimer);saveTimer=setTimeout(flush,500);status();}
async function flush(){
  if(!dirty||saving||conflict||!user)return;
  saving=true;status();const snapshot=JSON.stringify(state);
  try{const result=await api('/state','PUT',{revision,state:JSON.parse(snapshot)});revision=result.revision;saveError='';dirty=JSON.stringify(state)!==snapshot;if(dirty)storeDraft();else localStorage.removeItem(draftKey());}
  catch(e){saveError=e.message;if(e.status===409)conflict=true;}
  finally{saving=false;status();if(dirty&&!saveError)saveTimer=setTimeout(flush,100);}
}
function status(){
  const el=$('#save-state');if(!el)return;
  el.className=`save-state ${saveError?'error':dirty||saving?'pending':''}`;
  el.innerHTML=`<span class="dot"></span>${conflict?'Sync conflict':saveError?'Saved on this device':saving?'Saving…':dirty?'Waiting to save':'Saved to NAS'}`;
  const warning=$('#sync-warning');if(warning)warning.innerHTML=saveError?`<div class="alert">${esc(saveError)} <div><button class="small" data-action="export">Export this copy</button>${conflict?'<button class="small" data-action="reload">Reload NAS copy</button>':'<button class="small" data-action="retry">Retry save</button>'}</div></div>`:'';
}
window.addEventListener('online',flush);setInterval(()=>{if(dirty&&!conflict)flush();},15000);
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
const navIcons={workouts:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',session:'<path d="M12 5v14M5 12h14"/>',history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',progress:'<path d="M4 19h16M5 15l5-5 4 3 5-8"/>',settings:'<path d="m9 3-.6 2.4-2 .9-2.2-.7-2 3.4 1.7 1.7v2.6L2.2 15l2 3.4 2.3-.7 2 .9L9 21h4l.6-2.4 2-.9 2.2.7 2-3.4-1.7-1.7v-2.6L19.8 9l-2-3.4-2.3.7-2-.9L13 3Z"/><circle cx="11" cy="12" r="3"/>'};
function navIcon(id){return '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+navIcons[id]+'</svg>';}
function brand(){return '<div class="brand"><img class="brand-logo" src="/icon-192.png" alt="">repbook<span class="muted">.</span></div>';}
function shell(){
  const nav=[['workouts','▤','Workouts'],['session','＋','Session'],['history','◷','History'],['progress','↗','Progress'],['settings','⚙','Settings']];
  $('#app').innerHTML=`<div class="shell"><aside class="sidebar">${brand()}<div class="nav-spacer"></div><nav class="nav" aria-label="Main navigation">${nav.map(([id,icon,name])=>`<button data-page="${id}" class="${id==='settings'?'mobile-settings ':''}${page===id?'active':''}" aria-label="${name}" ${page===id?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${navIcon(id)}</span>${name}</button>`).join('')}</nav><div class="sidebar-bottom"><strong>${esc(user.username)}</strong><button class="sidebar-settings ${page==='settings'?'active':''}" data-page="settings" aria-label="Settings" title="Settings" ${page==='settings'?'aria-current="page"':''}>${navIcon("settings")}</button></div></aside><main class="main"><div class="topbar"><div class="mobile-brand">${brand()}</div><span class="topbar-date">${new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</span><span id="save-state" role="status"></span></div><div id="sync-warning"></div><div id="content"></div></main></div>`;
  ({workouts:workoutsView,session:sessionView,history:historyView,progress:progressView,settings:settingsView}[page])();filterLists();status();
}
function header(kicker,title,subtitle='',action=''){return `<div class="page-head"><div><h1>${title}</h1>${subtitle?`<p class="muted">${subtitle}</p>`:''}</div>${action}</div>`;}
function workoutsView(){
  const recent=state.sessions.filter(s=>new Date(s.date+'T12:00:00')>=new Date(today()+'T00:00:00').getTime()-27*86400000);
  const total=state.sessions.reduce((n,s)=>n+s.exercises.reduce((n,e)=>n+completedSets(e).length,0),0);
  $('#content').innerHTML=header('Make a little progress','Your workouts','','<div class="button-row"><button class="primary" data-action="start-empty">Start empty session</button><button data-action="new-template">＋ New workout</button></div>')+
    (state.active?`<div class="banner"><div><strong>${esc(state.active.templateName)} is in progress</strong><p>${state.active.exercises.reduce((n,e)=>n+completedSets(e).length,0)} sets logged · ${dateLabel(state.active.date)}</p></div><button class="primary" data-page="session">Continue session →</button></div>`:'')+
    `<div class="stats"><div class="stat"><span class="eyebrow">Last 28 days</span><div class="stat-number">${recent.length}</div><span class="stat-label">sessions completed</span></div><div class="stat"><span class="eyebrow">All time</span><div class="stat-number">${number(total)}</div><span class="stat-label">sets logged</span></div><div class="stat"><span class="eyebrow">Your routine</span><div class="stat-number">${state.templates.length}</div><span class="stat-label">workout templates</span></div></div><div class="section-title"><h2>Workout templates</h2></div>${filterBar("workouts",filters.workouts.q,filters.workouts.type)}<p id="filter-empty" class="muted" hidden>No matching workouts.</p><div class="cards">${state.templates.map((t,i)=>`<article class="workout-card" data-browse-id="${t.id}"><div class="card-top"><h2>${esc(t.name)}</h2><span class="day-number">${String(i+1).padStart(2,'0')}</span></div><ul class="exercise-list">${t.exerciseIds.map(id=>{const e=state.exercises.find(e=>e.id===id);return `<li>${esc(e.name)}<small>${t.recommendations?.[id]?`${t.recommendations[id].sets} × ${t.recommendations[id].reps} reps` : esc(e.group)}</small></li>`;}).join('')}</ul><div class="card-bottom"><button class="primary" data-action="start" data-id="${t.id}">Start workout →</button><button class="icon-button" data-action="edit-template" data-id="${t.id}" aria-label="Edit ${esc(t.name)}">Edit</button></div></article>`).join('')}</div>`+(state.templates.length?'':'<div class="empty"><h3>Your routine starts here</h3><button data-action="new-template">Create a workout</button></div>');
}
function currentSession(){return editingId?state.sessions.find(s=>s.id===editingId):state.active;}
function makeSet(e){return {id:uid(),weight:null,reps:null,mode:e.bodyweight?'added':'weighted',done:false};}
async function start(id){
  if(state.active){page='session';editingId=null;shell();toast('Finish or discard your current session first.');return;}
  const t=id===null?{name:'Freestyle session',exerciseIds:[]}:state.templates.find(t=>t.id===id);if(!t)throw new Error('Workout not found.');
  state.active={id:uid(),templateName:t.name,date:today(),notes:'',exercises:t.exerciseIds.map(id=>{const e=state.exercises.find(e=>e.id===id);const r=t.recommendations?.[id];return {exerciseId:id,name:e.name,...(r?{recommendation:{...r}}:{}),sets:Array.from({length:r?.sets||1},()=>makeSet(e))};})};
  editingId=null;changed();page='session';shell();
}
function sessionView(){
  const s=currentSession();if(!s){$('#content').innerHTML=header('Your next session','Ready when you are')+'<div class="empty"><h3>No workout in progress</h3><p>Start from a template or add exercises as you go.</p><div class="button-row"><button class="primary" data-action="start-empty">Start empty session</button><button data-page="workouts">Choose a workout</button></div></div>';return;}
  if(!editingId){let updated=false;for(const e of s.exercises)for(const set of e.sets){const done=Number.isInteger(set.reps)&&set.reps>0;if(done!==set.done){set.done=done;updated=true;}}if(updated)changed();}
  const done=s.exercises.reduce((n,e)=>n+completedSets(e).length,0);
  $('#content').innerHTML=header(editingId?'Edit your log':'One set at a time',esc(s.templateName),editingId?'Changes save automatically.':'Enter kg and reps. Blank kg = bodyweight; negative kg = assistance.')+
    `<div class="session-meta"><label>Session date<input type="date" id="session-date" value="${s.date}" required></label>${editingId?'<button data-action="close-edit">Back to history</button>':'<button class="primary compact-finish" data-action="finish">Finish session</button>'}</div><div class="session-layout"><div>${!s.exercises.length?'<div class="empty"><h3>Add your first exercise</h3><p>Build this session as you go.</p></div>':''}${s.exercises.map((e,ei)=>exercisePanel(e,ei,s)).join('')}<button data-action="session-add">＋ Add an exercise</button></div><aside class="session-side"><div class="panel"><p class="eyebrow">This session</p><div class="stat-number"><span id="session-set-count">${done}</span> <span class="muted" id="session-set-label">${done===1?'set':'sets'}</span></div>${editingId?'<button class="primary" data-action="close-edit">Done editing</button>':'<button class="primary" data-action="finish">Finish session ✓</button>'}<p class="note">Sets with reps are logged automatically.</p>${!editingId?'<button class="ghost danger" data-action="discard">Discard session</button>':''}</div><p class="note">For dumbbells, log kg per dumbbell. For single-leg or single-arm work, log reps per side. Stay consistent over time.</p></aside></div>`;
}
function repControl(e,ei,set,si){
  const attrs=`aria-label="${esc(e.name)} set ${si+1} reps" data-field="reps" data-e="${ei}" data-s="${si}"`;
  if(!matchMedia('(pointer: coarse)').matches)return `<input ${attrs} type="number" inputmode="numeric" min="1" max="1000" step="1" placeholder="${e.recommendation?.reps??'—'}" value="${set.reps??''}">`;
  const options=Array.from({length:20},(_,i)=>i+1);if(set.reps>20)options.push(set.reps);
  return `<select ${attrs}><option value="" ${set.reps===null?'selected':''}>${e.recommendation?'Target '+e.recommendation.reps:'—'}</option>${options.map(n=>`<option value="${n}" ${set.reps===n?'selected':''}>${n}</option>`).join('')}<option value="custom">Other…</option></select>`;
}
function exercisePanel(e,ei,session){
  const def=state.exercises.find(x=>x.id===e.exerciseId),prev=lastExercise(state.sessions,e.exerciseId,session.id);
  return `<article class="panel exercise-panel"><div class="exercise-heading"><div><h3><button class="exercise-link" data-action="open-progress" data-id="${e.exerciseId}" aria-label="View progress for ${esc(e.name)}">${esc(e.name)} <span aria-hidden="true">↗</span></button></h3><small>${e.recommendation?`Target: ${e.recommendation.sets} × ${e.recommendation.reps} reps · `:""}${esc(def.group)}</small></div><button class="remove-set" data-action="remove-exercise" data-e="${ei}" aria-label="Remove ${esc(e.name)}">×</button></div><div class="last">${prev?`<strong>Last time</strong> · ${dateLabel(prev.date)}<br>${completedSets(prev).map(setLabel).map(esc).join(' &nbsp; / &nbsp; ')}`:'No previous sets yet. This is your starting point.'}</div><div class="sets"><div class="set-row header" aria-hidden="true"><span>Set</span><span>kg</span><span>Reps</span><span></span></div>${e.sets.map((set,si)=>`<div class="set-row ${set.done?'logged':''}"><span class="set-index">${si+1}</span><input aria-label="${esc(e.name)} set ${si+1} kilograms" data-field="weight" data-e="${ei}" data-s="${si}" type="number" inputmode="decimal" min="-2000" max="2000" step="0.25" placeholder="BW" value="${set.weight===null?'':set.mode==='assisted'?-set.weight:set.weight}">${repControl(e,ei,set,si)}<button class="remove-set" data-action="remove-set" data-e="${ei}" data-s="${si}" aria-label="Delete set ${si+1}">×</button></div>`).join('')}</div><div class="exercise-footer"><button class="small" data-action="add-set" data-e="${ei}">＋ Add set</button>${prev?`<button class="small ghost" data-action="copy-last" data-e="${ei}">Use last session</button>`:''}</div></article>`;
}
function historyView(){
  const sessions=[...state.sessions].sort((a,b)=>b.date.localeCompare(a.date)||b.finishedAt.localeCompare(a.finishedAt));
  $('#content').innerHTML=header('The work adds up','Your history',`${sessions.length} completed session${sessions.length===1?'':'s'}`)+filterBar('history',filters.history.q,filters.history.type)+'<p id="filter-empty" class="muted" hidden>No matching sessions.</p>'+(sessions.length?`<div class="panel">${sessions.map(s=>`<div class="history-row" data-browse-id="${s.id}"><div class="history-left"><div class="date-tile">${new Date(s.date+'T12:00:00').toLocaleDateString(undefined,{month:'short'})}<strong>${Number(s.date.slice(-2))}</strong></div><div><h3>${esc(s.templateName)}</h3><p>${dateLabel(s.date)} · ${s.exercises.filter(e=>completedSets(e).length).length} exercise${s.exercises.filter(e=>completedSets(e).length).length===1?'':'s'} · ${s.exercises.reduce((n,e)=>n+completedSets(e).length,0)} sets</p></div></div><button data-action="view-session" data-id="${s.id}">View</button></div>`).join('')}</div>`:'<div class="empty"><h3>Your first session belongs here</h3><p>Finish a workout and your sets, reps and weights will show up here.</p><button class="primary" data-page="workouts">Choose a workout →</button></div>');
}
const metrics={weight:['Heaviest weight','kg','Best logged load per session. Unassisted weights only.'],added:['Heaviest added weight','kg','Added weight on top of bodyweight. Bodyweight itself is not included.'],bodyReps:['Best bodyweight set','reps','Most reps in one set with a blank weight.'],assistance:['Least assistance','kg','Lowest assisted load in a session. Lower means less assistance; compare reps too.'],reps:['Total reps','reps','All completed reps in the session, across all load types.'],volume:['External weight volume','kg·reps','Sum of weight × reps for weighted sets only. Excludes bodyweight, added-weight and assisted sets. Per-dumbbell entries are not doubled.']};
function progressView(){
  if(selectedExercise){progressDetail();return;}
  $('#content').innerHTML=header('','Progress')+filterBar('progress',progressSearch,progressFilter)+'<div id="progress-cards"></div>';
  progressCards();
}
function progressCards(){

  const logged=state.exercises.map(e=>({...e,previous:lastExercise(state.sessions,e.id)})).filter(e=>e.previous);
  const exercises=logged.filter(e=>matchesFilter([e],e.name,progressSearch,progressFilter)).sort((a,b)=>b.previous.date.localeCompare(a.previous.date)||a.name.localeCompare(b.name));
  $('#progress-cards').innerHTML=exercises.length?'<div class="progress-grid">'+exercises.map(e=>{
    const mode=progressModes(state.sessions,e.id)[0],data=series(state.sessions,e.id,mode),[label,unit]=metrics[mode];
    return '<button class="progress-card" data-action="open-progress" data-id="'+e.id+'"><div class="progress-card-head"><h2>'+esc(e.name)+'</h2><span aria-hidden="true">↗</span></div><span class="note">'+esc(label)+'</span><div class="progress-value">'+number(data.at(-1).value)+' <span>'+unit+'</span></div>'+sparkline(data)+'<div class="progress-card-foot"><span>'+dateLabel(e.previous.date)+'</span><span>'+data.length+' session'+(data.length===1?'':'s')+'</span></div></button>';
  }).join('')+'</div>':logged.length?'<div class="empty"><h3>No matching exercises</h3><p>Try another workout or search.</p></div>':'<div class="empty"><h3>No sessions yet</h3><p>Finish a workout to see your exercises and their progress here.</p><button class="primary" data-page="workouts">Choose a workout</button></div>';
}
function sparkline(data){
  const min=Math.min(...data.map(d=>d.value)),max=Math.max(...data.map(d=>d.value)),range=max-min||1;
  const first=Date.parse(data[0].date),span=Date.parse(data.at(-1).date)-first;
  const x=d=>span?8+(Date.parse(d.date)-first)/span*264:140,y=d=>max===min?40:65-(d.value-min)/range*48;
  return '<svg class="sparkline" viewBox="0 0 280 80" aria-hidden="true"><polyline points="'+data.map(d=>x(d)+','+y(d)).join(' ')+'"/>'+data.map(d=>'<circle cx="'+x(d)+'" cy="'+y(d)+'" r="3"/>').join('')+'</svg>';
}
function progressDetail(){
  const exercise=state.exercises.find(e=>e.id===selectedExercise);
  if(!exercise){selectedExercise='';progressView();return;}
  const modes=progressModes(state.sessions,selectedExercise);
  if(!modes.includes(metric))metric=modes[0]||(exercise.bodyweight?'bodyReps':'weight');
  const data=series(state.sessions,selectedExercise,metric),[label,unit,description]=metrics[metric];
  $('#content').innerHTML='<button class="back-button" data-action="progress-back">← All exercises</button>'+header('',esc(exercise.name))+
    (modes.length>1?'<div class="filter-chips mode-chips" role="group" aria-label="Logged load types">'+modes.map(m=>'<button class="small '+(metric===m?'selected':'')+'" data-action="progress-mode" data-id="'+m+'" aria-pressed="'+(metric===m)+'">'+({weight:'Weighted',added:'Added weight',bodyReps:'Bodyweight',assistance:'Assisted'}[m])+'</button>').join('')+'</div>':'')+
    '<div class="panel"><div class="chart-title"><div><span class="eyebrow">'+label+'</span><div class="chart-value">'+(data.length?number(data.at(-1).value)+' <span class="muted">'+unit+'</span>':'—')+'</div><p class="note">'+(data.length?'Latest · '+dateLabel(data.at(-1).date):'No completed sets yet')+'</p></div></div>'+
    (data.length?chart(data,unit):'<div class="empty"><p>Log this exercise in a completed session to see its graph.</p></div>')+'<p class="note">'+description+'</p></div>'+
    (data.length?'<div class="panel"><h2>Sets by session</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Completed sets</th></tr></thead><tbody>'+[...state.sessions].filter(s=>s.exercises.some(e=>e.exerciseId===selectedExercise&&completedSets(e).length)).sort((a,b)=>b.date.localeCompare(a.date)||b.finishedAt.localeCompare(a.finishedAt)).map(s=>'<tr><td>'+dateLabel(s.date)+'</td><td>'+s.exercises.filter(e=>e.exerciseId===selectedExercise).flatMap(completedSets).map(setLabel).map(esc).join(' / ')+'</td></tr>').join('')+'</tbody></table></div></div>':'');
}
function chart(data,unit){
  const W=760,H=260,L=62,R=20,T=20,B=42,max=Math.max(...data.map(d=>d.value),1)*1.12;
  const first=Date.parse(data[0].date),last=Date.parse(data.at(-1).date),span=last-first;
  const x=d=>span?L+(Date.parse(d.date)-first)/span*(W-L-R):(W+L-R)/2,y=v=>H-B-v/max*(H-T-B);
  const ticks=Array.from({length:5},(_,i)=>max*i/4);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(metrics[metric][0])} over time. Exact values are in the table below.">${ticks.map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}"/><text x="${L-10}" y="${y(v)+4}" text-anchor="end">${number(v)}</text>`).join('')}<polyline points="${data.map(d=>`${x(d)},${y(d.value)}`).join(' ')}"/>${data.map(d=>`<circle cx="${x(d)}" cy="${y(d.value)}" r="5"><title>${dateLabel(d.date)}: ${number(d.value)} ${unit}</title></circle>`).join('')}<text x="${L}" y="${H-8}">${dateLabel(data[0].date)}</text>${data.length>1?`<text x="${W-R}" y="${H-8}" text-anchor="end">${dateLabel(data.at(-1).date)}</text>`:''}</svg>`;
}
function settingsView(){
  $('#content').innerHTML=header('Keep it yours','Settings',`Signed in as ${esc(user.username)}`,'<button data-action="logout">Sign out</button>')+`<div class="settings-grid"><section class="panel"><h2>Exercise preferences</h2>${filterBar("settings",filters.settings.q,filters.settings.type)}<p id="filter-empty" class="muted" hidden>No matching exercises.</p><div class="settings-list">${state.exercises.map(e=>`<button data-browse-id="${e.id}" data-action="exercise-settings" data-id="${e.id}">${esc(e.name)} <span class="muted">→</span></button>`).join('')}</div></section><div class="stack"><section class="panel"><h2>Your data</h2><p class="note">Each account has its own templates and history. Export a copy any time. Import replaces this account’s workout data.</p><div class="button-row"><button data-action="export">Export backup</button><button data-action="import">Import backup</button></div><input class="visually-hidden" id="import-file" type="file" accept="application/json,.json" aria-label="Import backup file"></section><section class="panel"><h2>On your phone</h2><p class="note">Open your HTTPS Tailscale address. On iPhone, use Safari → Share → Add to Home Screen. On Android, use your browser’s Install app option.</p>${installPrompt?'<button data-action="install">Install Repbook</button>':''}<p class="note">An open session keeps your changes during a connection drop and retries saving. Opening the app or signing in needs your NAS connection.</p></section><section class="panel"><h2>Change password</h2><form id="password-form" class="stack"><label>Current password<input type="password" name="currentPassword" autocomplete="current-password" required></label><label>New password<input type="password" name="password" minlength="10" maxlength="200" autocomplete="new-password" required></label><p class="form-error" role="alert"></p><button>Update password</button></form></section>${user.admin?'<section class="panel"><h2>Add a user</h2><p class="note">New users start with the starter templates and an empty log.</p><form id="user-form" class="stack"><label>Username<input name="username" pattern="[a-zA-Z0-9_.-]{2,32}" autocomplete="off" required></label><label>Password<input type="password" name="password" minlength="10" maxlength="200" autocomplete="new-password" required></label><p class="form-error" role="alert"></p><button>Create user</button></form></section>':''}</div></div>`;
}
function openModal(title,content){const d=$('#modal');d.setAttribute('aria-labelledby','dialog-title');d.innerHTML=`<div class="modal-head"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">×</button></div>${content}`;if(!d.open)d.showModal();pickerOptions();}
function closeModal(){$('#modal').close();}
function confirmAction(title,message,action,label='Confirm'){openModal(title,`<p>${esc(message)}</p><div class="button-row"><button class="primary" data-action="${action}">${label}</button><button data-action="close-modal">Cancel</button></div>`);}
function templateEditor(id){filters.picker={q:'',type:'all'};const t=state.templates.find(t=>t.id===id);templateDraft=t?structuredClone(t):{id:uid(),name:'',exerciseIds:[]};renderTemplate();}
function renderTemplate(){openModal('Workout template',`<form id="template-form" class="stack"><label>Workout name<input id="template-name" name="name" maxlength="120" value="${esc(templateDraft.name)}" placeholder="e.g. Day 1" required></label><div class="modal-list">${templateDraft.exerciseIds.map((id,i)=>`<div class="template-row"><span>${esc(state.exercises.find(e=>e.id===id).name)}</span><label>Sets<input type="number" min="1" max="10" data-plan="sets" data-id="${id}" value="${templateDraft.recommendations?.[id]?.sets??''}" placeholder="—" aria-label="Recommended sets for ${esc(state.exercises.find(e=>e.id===id).name)}"></label><label>Reps<input type="number" min="1" max="100" data-plan="reps" data-id="${id}" value="${templateDraft.recommendations?.[id]?.reps??''}" placeholder="—" aria-label="Recommended reps for ${esc(state.exercises.find(e=>e.id===id).name)}"></label><button type="button" data-action="template-up" data-i="${i}" aria-label="Move exercise up" ${i===0?'disabled':''}>↑</button><button type="button" data-action="template-down" data-i="${i}" aria-label="Move exercise down" ${i===templateDraft.exerciseIds.length-1?'disabled':''}>↓</button><button type="button" data-action="template-remove" data-i="${i}" aria-label="Remove exercise">×</button></div>`).join('')}</div>${filterBar("picker",filters.picker.q,filters.picker.type)}<label>Add an exercise<select id="template-exercise"><option value="">Choose an exercise…</option>${state.exercises.filter(e=>!templateDraft.exerciseIds.includes(e.id)).map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label><div class="button-row"><button type="button" data-action="template-add">Add selected</button><button type="button" data-action="custom-exercise">＋ Custom exercise</button></div><p class="form-error" role="alert"></p><div class="button-row"><button class="primary">Save workout</button>${state.templates.some(t=>t.id===templateDraft.id)?'<button type="button" class="danger" data-action="delete-template">Delete workout</button>':''}</div></form>`);}
function exerciseEditor(id,returnTemplate=false){
  const e=state.exercises.find(e=>e.id===id)||{id:uid(),name:'',group:'',bodyweight:false,increment:2.5,repMin:8,repMax:12};
  openModal(id?'Exercise preferences':'Custom exercise',`<form id="exercise-form" class="stack" data-id="${e.id}" data-return="${returnTemplate}"><label>Exercise name<input name="name" value="${esc(e.name)}" maxlength="120" required></label><label>Body area<select name="category">${["Upper body","Lower body","Core","Other"].map(c=>`<option ${category(e)===c?"selected":""}>${c}</option>`).join('')}</select></label><label>Muscle group (optional)<input name="group" value="${esc(e.group)}" maxlength="80"></label><label class="check-label"><input type="checkbox" name="bodyweight" ${e.bodyweight?'checked':''}>Usually a bodyweight exercise</label><p class="form-error" role="alert"></p><button class="primary">Save exercise</button></form>`);
}
function showSession(id){const s=state.sessions.find(s=>s.id===id);openModal(s.templateName,`<p class="muted">${dateLabel(s.date)}</p>${s.exercises.filter(e=>completedSets(e).length).map(e=>`<div class="detail-exercise"><h3>${esc(e.name)}</h3><p>${completedSets(e).map(setLabel).map(esc).join(' / ')}</p></div>`).join('')}${s.notes?`<div class="detail-exercise"><h3>Notes</h3><p>${esc(s.notes)}</p></div>`:''}<hr class="divider"><div class="button-row"><button class="primary" data-action="edit-session" data-id="${id}">Edit session</button><button class="danger" data-action="delete-session" data-id="${id}">Delete</button></div>`);}
function exportData(){const blob=new Blob([JSON.stringify({format:'repbook',version:1,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`repbook-${user.username}-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function boot(){
  try{const auth=await api('/auth');user=auth.user;if(!user){authView(auth.needsSetup);return;}
    const result=await api('/state');state=result.state;revision=result.revision;dirty=false;conflict=false;saveError='';
    let draft;try{draft=JSON.parse(localStorage.getItem(draftKey()));}catch{}
    if(draft?.state){if(JSON.stringify(draft.state)===JSON.stringify(state))localStorage.removeItem(draftKey());else{state=draft.state;dirty=true;if(draft.revision!==revision){conflict=true;saveError='This device has unsaved changes, and the NAS has a different version. Export this copy before reloading the NAS copy.';}else saveError='Recovered unsaved changes from this device. Reconnecting…';}}
    shell();if(dirty&&!conflict)flush();
    if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'start_workout_session',description:'Start a workout from an existing template and show its set logger. Does not mark sets complete.',inputSchema:{type:'object',properties:{templateId:{type:'string'}},required:['templateId'],additionalProperties:false},execute:async input=>{if(typeof input?.templateId!=='string'||!state.templates.some(t=>t.id===input.templateId))throw new Error('Unknown workout template.');if(state.active)throw new Error('A workout is already in progress.');await start(input.templateId);await flush();return {sessionId:state.active.id,saved:!dirty};}});}catch{}}
  }catch(e){$('#app').innerHTML=`<div class="auth-form"><div class="auth-inner">${brand()}<h1>Can’t reach your NAS</h1><p>${esc(e.message)}</p><p class="note">Check Tailscale and your NAS, then try again. Any unsaved workout draft remains on this device.</p><button data-action="boot">Try again</button></div></div>`;}
}
function authView(setup){$('#app').innerHTML=`<div class="auth-page"><main class="auth-form"><div class="auth-inner">${brand()}<h1>${setup?'Create an account':'Sign in'}</h1><form id="auth-form" data-setup="${setup}"><label>Username<input name="username" autocomplete="username" pattern="[a-zA-Z0-9_.-]{2,32}" minlength="2" maxlength="32" required></label><label>Password<input name="password" type="password" autocomplete="${setup?'new-password':'current-password'}" minlength="10" maxlength="200" required></label>${setup?'<span class="note">At least 10 characters.</span>':''}<p class="form-error" role="alert"></p><button class="primary">${setup?'Create account':'Sign in'}</button></form></div></main></div>`;}
document.addEventListener('input',e=>{
  const el=e.target;if(el.dataset.search){const key=el.dataset.search;if(key==='progress'){progressSearch=el.value;progressCards();}else{filters[key].q=el.value;if(key==='picker')pickerOptions();else filterLists();}return;}if(el.id==='progress-search'){progressSearch=el.value;progressCards();return;}if(el.id==='template-name'){templateDraft.name=el.value;return;}
  if(el.dataset.plan){templateDraft.recommendations??={};const r=templateDraft.recommendations[el.dataset.id]??={sets:null,reps:null};r[el.dataset.plan]=el.value===''?null:Number(el.value);return;}
  if(!el.dataset.field)return;
  if(el.dataset.field==='reps'&&el.value==='custom'){
    const input=document.createElement('input');for(const attr of el.attributes)input.setAttribute(attr.name,attr.value);
    input.type='number';input.inputMode='numeric';input.min='1';input.max='1000';input.step='1';input.value=currentSession().exercises[Number(el.dataset.e)].sets[Number(el.dataset.s)].reps??'';el.replaceWith(input);input.focus();return;
  }
  if(!el.validity.valid)return;
  const set=currentSession().exercises[Number(el.dataset.e)].sets[Number(el.dataset.s)],field=el.dataset.field,previous={...set};
  if(field==='weight'){
    const value=el.value===''?null:Number(el.value),def=state.exercises.find(e=>e.id===currentSession().exercises[Number(el.dataset.e)].exerciseId);
    set.weight=value===null?null:Math.abs(value);set.mode=value<0?'assisted':def.bodyweight?'added':'weighted';
  }else set.reps=el.value===''?null:Number(el.value);
  set.done=Number.isInteger(set.reps)&&set.reps>0;
  if($('#session-set-count'))$('#session-set-count').textContent=currentSession().exercises.reduce((n,e)=>n+completedSets(e).length,0);
  if($('#session-set-label'))$('#session-set-label').textContent=$('#session-set-count').textContent==='1'?'set':'sets';
  if(editingId&&!currentSession().exercises.some(e=>completedSets(e).length)){Object.assign(set,previous);el.value=previous[field]??'';toast('Keep one set with reps, or delete the session from History.');return;}
  changed();
});
document.addEventListener('change',async e=>{
  const el=e.target;
  if(el.dataset.category){const key=el.dataset.category;if(key==='progress'){progressFilter=el.value;progressCards();}else{filters[key].type=el.value;if(key==='picker')pickerOptions();else filterLists();}return;}

  if(el.id==='session-date'){if(!el.value||!el.validity.valid){el.value=currentSession().date;return;}currentSession().date=el.value;changed();}
  if(el.id==='hints'){state.settings.hints=el.checked;changed();}
  if(el.id==='import-file'&&el.files[0]){
    try{if(el.files[0].size>8*1024*1024)throw new Error('This backup is too large.');const backup=JSON.parse(await el.files[0].text());if(backup.format!=='repbook'||backup.version!==1||!backup.state)throw new Error('Choose a Repbook version 1 backup.');window.pendingImport=backup.state;confirmAction('Replace this account’s data?','This replaces your templates and workout history. Export your current data first if you want to keep a copy.','confirm-import','Replace data');}catch(err){toast(err.message);}el.value='';
  }
});
document.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,button=f.querySelector('button[type="submit"],button:not([type])'),err=f.querySelector('.form-error');if(err)err.textContent='';if(button)button.disabled=true;
  try{const data=Object.fromEntries(new FormData(f));
    if(f.id==='auth-form'){await api(f.dataset.setup==='true'?'/setup':'/login','POST',data);await boot();}
    if(f.id==='user-form'){await api('/users','POST',data);f.reset();toast('User created. They can sign in now.');}
    if(f.id==='password-form'){await api('/password','POST',data);f.reset();toast('Password updated. Other sessions have been signed out.');}
    if(f.id==='template-form'){
      for(const [id,r] of Object.entries(templateDraft.recommendations||{})){if(!templateDraft.exerciseIds.includes(id)||(r.sets===null&&r.reps===null)){delete templateDraft.recommendations[id];continue;}if(!Number.isInteger(r.sets)||r.sets<1||r.sets>10||!Number.isInteger(r.reps)||r.reps<1||r.reps>100)throw new Error('Enter both recommended sets (1–10) and reps (1–100), or leave both blank.');}
      if(!templateDraft.exerciseIds.length)throw new Error('Add at least one exercise.');templateDraft.name=data.name.trim();if(!templateDraft.name)throw new Error('Enter a workout name.');
      const index=state.templates.findIndex(t=>t.id===templateDraft.id);if(index<0)state.templates.push(templateDraft);else state.templates[index]=templateDraft;changed();closeModal();shell();toast('Workout saved.');
    }
    if(f.id==='exercise-form'){
      const ex={id:f.dataset.id,name:data.name.trim(),group:data.group.trim(),category:data.category,bodyweight:data.bodyweight==='on',repMin:state.exercises.find(x=>x.id===f.dataset.id)?.repMin||8,repMax:state.exercises.find(x=>x.id===f.dataset.id)?.repMax||12,increment:state.exercises.find(x=>x.id===f.dataset.id)?.increment||2.5};
      if(!ex.name||ex.repMax<ex.repMin)throw new Error('Enter a name and a valid rep range.');
      const index=state.exercises.findIndex(x=>x.id===ex.id);if(index<0)state.exercises.push(ex);else state.exercises[index]=ex;
      changed();if(f.dataset.return==='true'){templateDraft.exerciseIds.push(ex.id);renderTemplate();}else if(f.dataset.return==='session'){currentSession().exercises.push({exerciseId:ex.id,name:ex.name,sets:[makeSet(ex)]});changed();closeModal();shell();}else{closeModal();shell();}toast('Exercise saved.');
    }
  }catch(error){if(err)err.textContent=error.message;else toast(error.message);}finally{if(button)button.disabled=false;}
});
document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b)return;
  if(page==='session'&&!b.closest('dialog')){const invalid=document.querySelector('#content input:invalid');if(invalid){invalid.reportValidity();return;}}
  if(b.dataset.page){if(b.dataset.page==='progress')selectedExercise='';if(editingId)editingId=null;page=b.dataset.page;shell();window.scrollTo(0,0);return;}
  const a=b.dataset.action;if(!a)return;
  try{
    if(a==='open-progress'){selectedExercise=b.dataset.id;metric=progressModes(state.sessions,selectedExercise)[0]||'weight';page='progress';shell();window.scrollTo(0,0);return;}
    if(a==='progress-back'){selectedExercise='';progressView();return;}
    if(a==='progress-filter'){progressFilter=b.dataset.id;progressView();return;}
    if(a==='progress-mode'){metric=b.dataset.id;progressDetail();return;}
    if(a==='boot')return boot();if(a==='close-modal')return closeModal();if(a==='export')return exportData();if(a==='retry')return flush();
    if(a==='reload')return confirmAction('Load the NAS copy?','Any unsaved changes on this device will be discarded. Export this copy first to keep it.','confirm-reload','Reload');
    if(a==='confirm-reload'){localStorage.removeItem(draftKey());dirty=false;closeModal();await boot();return;}
    if(a==='new-template')return templateEditor();if(a==='edit-template')return templateEditor(b.dataset.id);
    if(a==='start')return start(b.dataset.id);
    if(a==='start-empty')return start(null);
    if(a==='session-custom')return exerciseEditor(null,'session');
    if(a==='exercise-settings')return exerciseEditor(b.dataset.id);
    if(a==='custom-exercise')return exerciseEditor(null,true);
    if(a==='template-add'){const id=$('#template-exercise').value;if(id&&!templateDraft.exerciseIds.includes(id))templateDraft.exerciseIds.push(id);renderTemplate();return;}
    if(a.startsWith('template-')){const i=Number(b.dataset.i);if(a==='template-remove')templateDraft.exerciseIds.splice(i,1);if(a==='template-up'&&i>0)[templateDraft.exerciseIds[i-1],templateDraft.exerciseIds[i]]=[templateDraft.exerciseIds[i],templateDraft.exerciseIds[i-1]];if(a==='template-down'&&i<templateDraft.exerciseIds.length-1)[templateDraft.exerciseIds[i+1],templateDraft.exerciseIds[i]]=[templateDraft.exerciseIds[i],templateDraft.exerciseIds[i+1]];renderTemplate();return;}
    if(a==='delete-template')return confirmAction('Delete workout template?','Past sessions will stay in your history.','confirm-delete-template','Delete template');
    if(a==='confirm-delete-template'){state.templates=state.templates.filter(t=>t.id!==templateDraft.id);changed();closeModal();shell();return;}
    if(a==='view-session')return showSession(b.dataset.id);
    if(a==='edit-session'){editingId=b.dataset.id;page='session';closeModal();shell();return;}
    if(a==='delete-session'){window.deleteSessionId=b.dataset.id;return confirmAction('Delete this session?','This removes the session and its sets from your history and progress graphs.','confirm-delete-session','Delete session');}
    if(a==='confirm-delete-session'){state.sessions=state.sessions.filter(s=>s.id!==window.deleteSessionId);changed();closeModal();shell();return;}
    if(a==='close-edit'){editingId=null;page='history';shell();return;}
    if(a==='import'){if(dirty||saving||conflict)throw new Error('Save or resolve pending changes before importing.');$('#import-file').click();return;}
    if(a==='confirm-import'){if(dirty||saving||conflict)throw new Error('Save pending changes before importing.');const result=await api('/state','PUT',{revision,state:window.pendingImport});state=window.pendingImport;window.pendingImport=null;revision=result.revision;editingId=null;selectedExercise='';closeModal();shell();toast('Backup restored.');return;}
    if(a==='logout'){await flush();if(dirty)throw new Error('Save your changes before signing out. You can export a backup while disconnected.');await api('/logout','POST',{});localStorage.removeItem(draftKey());user=null;state=null;page='workouts';await boot();return;}
    if(a==='install'){await installPrompt.prompt();installPrompt=null;return;}
    const s=currentSession(),ei=Number(b.dataset.e),si=Number(b.dataset.s),ex=s?.exercises[ei],before=s?structuredClone(s):null;
    if(a==='add-set'){const def=state.exercises.find(x=>x.id===ex.exerciseId),last=ex.sets.at(-1);ex.sets.push(last?{...last,id:uid(),reps:null,done:false}:makeSet(def));}
    if(a==='remove-set')ex.sets.splice(si,1);
    if(a==='copy-last'){if(ex.sets.some(s=>s.done||s.weight!==null||s.reps!==null)){window.copyExercise=ei;return confirmAction('Replace these sets?','This replaces the current entries with your previous session’s sets. Enter reps to log each set.','confirm-copy','Use last session');}copyLast(ei);return;}
    if(a==='confirm-copy'){closeModal();copyLast(window.copyExercise);return;}
    if(a==='remove-exercise'){window.removeExercise=ei;return confirmAction('Remove this exercise?','Its sets will be removed from this session only.','confirm-remove-exercise','Remove exercise');}
    if(a==='confirm-remove-exercise'){s.exercises.splice(window.removeExercise,1);closeModal();}
    if(a==='session-add'){filters.picker={q:'',type:'all'};openModal('Add to this session',`${filterBar('picker')}<label>Exercise<select id="session-exercise">${state.exercises.filter(e=>!s.exercises.some(x=>x.exerciseId===e.id)).map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label><br><div class="button-row"><button class="primary" data-action="confirm-session-add">Add exercise</button><button data-action="session-custom">＋ Custom exercise</button></div>`);return;}
    if(a==='confirm-session-add'){const def=state.exercises.find(e=>e.id===$('#session-exercise').value);if(!def)return;s.exercises.push({exerciseId:def.id,name:def.name,sets:[makeSet(def)]});closeModal();}
    if(a==='discard')return confirmAction('Discard this session?','This deletes the unfinished session and its entries.','confirm-discard','Discard session');
    if(a==='confirm-discard'){state.active=null;closeModal();changed();page='workouts';shell();return;}
    if(a==='finish'){
      if(!s.exercises.some(e=>completedSets(e).length))throw new Error('Enter reps for at least one set before finishing.');
      if(s.exercises.some(e=>e.sets.some(x=>!x.done&&(x.reps!==null||x.weight!==null))))return confirmAction('Finish without these sets?','Sets without reps will be left out.','confirm-finish','Finish session');
      return finishSession();
    }
    if(a==='confirm-finish'){closeModal();return finishSession();}
    if(['add-set','tick','remove-set','confirm-remove-exercise','confirm-session-add'].includes(a)){
      if(editingId&&!s.exercises.some(e=>completedSets(e).length)){state.sessions[state.sessions.findIndex(x=>x.id===editingId)]=before;sessionView();throw new Error('Keep at least one set with reps, or delete the session from History.');}
      changed();sessionView();
    }
  }catch(e){toast(e.message);}
});
function copyLast(ei){const s=currentSession(),e=s.exercises[ei],prev=lastExercise(state.sessions,e.exerciseId,s.id);if(editingId&&!s.exercises.some((x,i)=>i!==ei&&completedSets(x).length)){toast('Keep a completed set in this historical session. Edit its values directly.');return;}e.sets=completedSets(prev).map(s=>({...s,id:uid(),reps:null,done:false}));changed();sessionView();}
function finishSession(){const s=state.active;s.exercises=s.exercises.map(e=>({...e,sets:completedSets(e)})).filter(e=>e.sets.length);s.finishedAt=new Date().toISOString();state.sessions.push(s);state.active=null;changed();page='history';shell();toast('Session saved.');}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;if(page==='settings'&&user)settingsView();});
if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js').catch(()=>{});
boot();
