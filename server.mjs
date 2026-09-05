import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { seed } from './seed.mjs';

const scrypt=promisify(scryptCb), root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.DATA_DIR||path.join(root,'data');
mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(path.join(dataDir,'repbook.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS states(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, revision INTEGER NOT NULL DEFAULT 0, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON tokens(expires); PRAGMA user_version=1;`);
const port=Number(process.env.PORT||3000), host=process.env.HOST||'0.0.0.0';
const appOrigin=process.env.APP_ORIGIN?new URL(process.env.APP_ORIGIN).origin:null;
const secure=process.env.COOKIE_SECURE==='true'||appOrigin?.startsWith('https:');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const sha=s=>createHash('sha256').update(s).digest('hex');
const attempts=new Map();
function rateLimit(req) {
  const now=Date.now(),key=req.socket.remoteAddress;
  for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
  const item=attempts.get(key)||{count:0,until:now+15*60*1000};
  if(++item.count>40)fail(429,'Too many sign-in attempts. Try again in 15 minutes.');
  attempts.set(key,item);
}
async function passwordHash(password) {const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;}
async function passwordMatches(password,encoded) {const [salt,key]=encoded.split(':');return timingSafeEqual(Buffer.from(key,'hex'),await scrypt(password,salt,64));}
function credentials(body) {
  if(typeof body.username!=='string'||! /^[a-zA-Z0-9_.-]{2,32}$/.test(body.username.trim()))fail(400,'Use 2–32 letters, numbers, dots, underscores or hyphens for a username.');
  if(typeof body.password!=='string'||body.password.length<10||body.password.length>200)fail(400,'Use a password between 10 and 200 characters.');
  return {username:body.username.trim(),password:body.password};
}
function token(req) {return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('repbook_session='))?.slice(16)||'';}
function user(req) {return db.prepare('SELECT users.id,username,admin FROM tokens JOIN users ON users.id=tokens.user_id WHERE hash=? AND expires>?').get(sha(token(req)),Date.now());}
function login(res,id) {
  const value=randomBytes(32).toString('hex');
  db.prepare('DELETE FROM tokens WHERE expires<?').run(Date.now());
  db.prepare('INSERT INTO tokens VALUES(?,?,?)').run(sha(value),id,Date.now()+30*86400000);
  res.setHeader('Set-Cookie',`repbook_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure?'; Secure':''}`);
}
function json(res,status,body) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req) {
  if(!(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Send JSON.');
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>8*1024*1024)fail(413,'The request is too large.');chunks.push(chunk);}
  try {const value=JSON.parse(Buffer.concat(chunks).toString());if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Invalid JSON.');return value;}catch{fail(400,'Invalid JSON.');}
}
const textOk=(v,max=120)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const idOk=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v);
const unique=arr=>new Set(arr).size===arr.length;
const numberOk=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateState(s) {
  const bad=()=>fail(400,'Some workout data is invalid. Check names, dates, reps and weights.');
  if(!s||!Array.isArray(s.exercises)||s.exercises.length>500||!Array.isArray(s.templates)||s.templates.length>100||!Array.isArray(s.sessions)||s.sessions.length>10000||typeof s.settings?.hints!=='boolean'||!(s.active===null||(typeof s.active==='object'&&!Array.isArray(s.active))))bad();
  if(!unique(s.exercises.map(x=>x?.id))||!unique(s.templates.map(x=>x?.id))||!unique(s.sessions.map(x=>x?.id)))bad();
  for(const e of s.exercises)if(!e||!idOk(e.id)||!textOk(e.name)||typeof e.group!=='string'||e.group.length>80||typeof e.bodyweight!=='boolean'||!numberOk(e.increment,0.25,100)||!Number.isInteger(e.repMin)||!Number.isInteger(e.repMax)||e.repMin<1||e.repMax<e.repMin||e.repMax>100)bad();
  const ids=new Set(s.exercises.map(e=>e.id));
  for(const t of s.templates)if(!t||!idOk(t.id)||!textOk(t.name)||!Array.isArray(t.exerciseIds)||!t.exerciseIds.length||t.exerciseIds.length>50||!unique(t.exerciseIds)||t.exerciseIds.some(id=>!ids.has(id)))bad();
  for(const session of [...s.sessions,...(s.active?[s.active]:[])]) {
    if(!session||!idOk(session.id)||!textOk(session.templateName)||typeof session.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(session.date)||!Number.isFinite(Date.parse(session.date))||new Date(session.date).toISOString().slice(0,10)!==session.date||typeof session.notes!=='string'||session.notes.length>4000||!Array.isArray(session.exercises)||session.exercises.length>50||!unique(session.exercises.map(e=>e?.exerciseId)))bad();
    if(s.sessions.includes(session)&&(!textOk(session.finishedAt)||!Number.isFinite(Date.parse(session.finishedAt))))bad();
    for(const e of session.exercises){
      if(!e||!ids.has(e.exerciseId)||!textOk(e.name)||!Array.isArray(e.sets)||e.sets.length>100||!unique(e.sets.map(x=>x?.id)))bad();
      for(const set of e.sets)if(!set||!idOk(set.id)||!['weighted','added','assisted'].includes(set.mode)||typeof set.done!=='boolean'||!(set.weight===null||numberOk(set.weight,0,2000))||!(set.reps===null||(Number.isInteger(set.reps)&&set.reps>=1&&set.reps<=1000))||(set.done&&set.reps===null))bad();
    }
  }
  if(s.active&&s.sessions.some(x=>x.id===s.active.id))bad();
  for(const session of s.sessions)if(!session.exercises.some(e=>e.sets.some(x=>x.done)))bad();
  return s;
}
const staticFiles=new Map(['/','/index.html','/app.js','/logic.js','/style.css','/sw.js','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png'].map(p=>[p,path.join(root,'public',p==='/'?'index.html':p.slice(1))]));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
    const url=new URL(req.url,'http://localhost'),p=url.pathname;
    if(p==='/api/health'&&req.method==='GET')return json(res,200,{ok:true});
    if(p.startsWith('/api/')){
      if(!['GET','HEAD'].includes(req.method)){
        const origin=req.headers.origin;
        const allowed=appOrigin||`http://${req.headers.host}`;
        if(origin!==allowed)fail(403,'This request came from an unexpected address. Check APP_ORIGIN.');
      }
      if(p==='/api/auth'&&req.method==='GET')return json(res,200,{user:user(req)||null,needsSetup:!db.prepare('SELECT 1 FROM users LIMIT 1').get()});
      if((p==='/api/setup'||p==='/api/login')&&req.method==='POST'){
        rateLimit(req);const c=credentials(await body(req));
        if(p==='/api/setup'){
          if(db.prepare('SELECT 1 FROM users LIMIT 1').get())fail(409,'The first account already exists. Please sign in.');
          const hash=await passwordHash(c.password);
          db.exec('BEGIN IMMEDIATE');
          let id;
          try{if(db.prepare('SELECT 1 FROM users LIMIT 1').get())fail(409,'The first account already exists.');
            id=Number(db.prepare('INSERT INTO users(username,password,admin) VALUES(?,?,1)').run(c.username,hash).lastInsertRowid);
            db.prepare('INSERT INTO states(user_id,body) VALUES(?,?)').run(id,JSON.stringify(seed()));db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
          login(res,id);return json(res,201,{ok:true});
        }
        const u=db.prepare('SELECT * FROM users WHERE username=?').get(c.username);
        const encoded=u?.password||`${'00'.repeat(16)}:${'00'.repeat(64)}`;
        if(!await passwordMatches(c.password,encoded)||!u)fail(401,'Username or password is incorrect.');
        login(res,u.id);return json(res,200,{ok:true});
      }
      const u=user(req);if(!u)fail(401,'Please sign in again.');
      if(p==='/api/logout'&&req.method==='POST'){
        db.prepare('DELETE FROM tokens WHERE hash=?').run(sha(token(req)));
        res.setHeader('Set-Cookie',`repbook_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`);return json(res,200,{ok:true});
      }
      if(p==='/api/users'&&req.method==='GET'){if(!u.admin)fail(403,'Only the owner can manage users.');return json(res,200,db.prepare('SELECT id,username,admin FROM users ORDER BY id').all());}
      if(p==='/api/users'&&req.method==='POST'){
        if(!u.admin)fail(403,'Only the owner can add users.');
        const c=credentials(await body(req)),hash=await passwordHash(c.password);
        if(db.prepare('SELECT 1 FROM users WHERE username=?').get(c.username))fail(409,'That username already exists.');
        db.exec('BEGIN IMMEDIATE');try{const id=Number(db.prepare('INSERT INTO users(username,password) VALUES(?,?)').run(c.username,hash).lastInsertRowid);db.prepare('INSERT INTO states(user_id,body) VALUES(?,?)').run(id,JSON.stringify(seed()));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
        return json(res,201,{ok:true});
      }
      if(p==='/api/password'&&req.method==='POST'){
        const b=await body(req);credentials({username:u.username,password:b.password});
        if(typeof b.currentPassword!=='string'||b.currentPassword.length>200||!await passwordMatches(b.currentPassword,db.prepare('SELECT password FROM users WHERE id=?').get(u.id).password))fail(403,'Current password is incorrect.');
        db.prepare('UPDATE users SET password=? WHERE id=?').run(await passwordHash(b.password),u.id);db.prepare('DELETE FROM tokens WHERE user_id=?').run(u.id);login(res,u.id);return json(res,200,{ok:true});
      }
      if(p==='/api/state'&&req.method==='GET'){const row=db.prepare('SELECT revision,body FROM states WHERE user_id=?').get(u.id);return json(res,200,{revision:row.revision,state:JSON.parse(row.body)});}
      if(p==='/api/state'&&req.method==='PUT'){
        const b=await body(req);if(!Number.isInteger(b.revision)||b.revision<0)fail(400,'Invalid revision.');
        const s=validateState(b.state);
        const result=db.prepare('UPDATE states SET body=?,revision=revision+1 WHERE user_id=? AND revision=?').run(JSON.stringify(s),u.id,b.revision);
        if(!result.changes)fail(409,'Another device saved newer changes. Export this device’s copy before reloading.');
        return json(res,200,{revision:b.revision+1});
      }
      fail(404,'Not found.');
    }
    if(!['GET','HEAD'].includes(req.method)||!staticFiles.has(p))fail(404,'Not found.');
    const file=staticFiles.get(p),content=readFileSync(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
  }catch(e){if(!e.status)console.error(e);if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Something went wrong. Your previous saved data is safe.'});else res.end();}
});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(port,host,()=>console.log(`Repbook ready at http://${host==='0.0.0.0'?'localhost':host}:${server.address().port}`));
function stop(){server.close(()=>{db.close();process.exit(0);});setTimeout(()=>process.exit(1),5000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
