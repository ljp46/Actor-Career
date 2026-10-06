import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {available,projectSchedule,genderCompatible,roleFitForAge} from '../engine.js';
const read=path=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path)));
const index=JSON.parse(fs.readFileSync('data/filmographies/index.json'));
assert.equal(index.actors.length,10);
assert.ok(fs.statSync('data/filmographies/index.json').size<500000,'Startup index stays small');
const projects=new Map(),base=new Map(),films=new Map();
for(const file of fs.readdirSync('data/years').filter(f=>f.endsWith('.gz')))for(const p of read(`data/years/${file}`).projects)if(p.kind==='Film')films.set(p.id,p);
for(const year of index.years){
 const data=read(`data/filmographies/years/${year}.json.gz`);assert.equal(data.year,year);
 for(const p of data.projects){assert.equal(p.year,year);assert.ok(!projects.has(p.id),'No duplicate production IDs');assert.ok(Array.isArray(p.roles));projects.set(p.id,p)}
 for(const p of read(`data/tv-seasons/years/${year}.json.gz`).projects)base.set(p.id,p);
}
for(const [id,p] of projects){
 const previous=base.get(id);
 if(previous)assert.deepEqual(p.roles.slice(0,previous.roles.length),previous.roles,'Preserve saved cast indices');
 if(p.roles.length){
  const r=p.roles.find(r=>index.actors.some(a=>a.id===r.personId))||p.roles[0],date=projectSchedule(p).castingStart;
  const birthYear=Math.min(p.year-(r.characterAge??Math.round((r.ageMin+r.ageMax)/2)),Number(date.slice(0,4))-4),gender=['male','female','nonbinary'].includes(r.gender)?r.gender:'male';
  const s={date,year:Number(date.slice(0,4)),month:Number(date.slice(5,7)),birthday:`${birthYear}-01-01`,activeId:'self',people:[{id:'self',birthYear,gender}],choices:[],casts:{},filmography:[],projects:[],complete:false};
  const expected=new Set(p.roles.flatMap((role,n)=>genderCompatible(gender,role.gender)&&roleFitForAge(p.year-birthYear,role)>=35?[n]:[]));
  assert.deepEqual(new Set(available(s,[p]).map(o=>o.index)),expected,`Every eligible added role reaches auditions: ${id}`);
 }
}
for(const id of Object.keys(index.shows)){
 const show=read(`data/filmographies/shows/${id}.json.gz`);
 for(const s of show.seasons){
  const p=projects.get(s.id);assert.ok(p);assert.equal(p.seriesId,id);
  for(const r of s.roles){assert.equal(p.roles[r.index].personId,r.actorId);assert.equal(p.roles[r.index].character,r.character)}
 }
}
for(const c of index.coverage){
 if(c.id.startsWith('tmdb-movie-')){
  const p=projects.get(c.id)||films.get(c.id);
  assert.ok(p,`Covered film exists: ${c.id}`);
  for(const actor of c.actors)assert.ok(p.roles.some(r=>r.personId===actor),`Missing requested film actor ${actor}: ${c.id}`);
 }else{
  const directory=index.shows[c.id]?'filmographies':'tv-seasons';
  const show=read(`data/${directory}/shows/${c.id}.json.gz`);
  for(const actor of c.actors)assert.ok(show.seasons.some(s=>s.roles.some(r=>r.actorId===actor)),`Missing requested season actor ${actor}: ${c.id}`);
 }
}
console.log('Permanent filmographies audited:',JSON.stringify(index.totals));
