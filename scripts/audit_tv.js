import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {available,projectSchedule,roleFitForAge,genderCompatible} from '../engine.js';

const read=p=>JSON.parse(gunzipSync(fs.readFileSync(p))),index=read('data/tv-seasons/index.json.gz'),shows={};
assert.ok(fs.statSync('data/tv-seasons/index.json.gz').size<1500000,'Season startup metadata must stay compact.');
for(const [id,summary] of Object.entries(index.shows)){
 const show=read(`data/tv-seasons/shows/${id}.json.gz`);assert.equal(show.id,id);assert.equal(show.seasons.length,summary.seasons.length);shows[id]=show;
}
let seasons=0,roles=0,empty=0;
for(let year=1960;year<=2026;year++){
 const data=read(`data/tv-seasons/years/${year}.json.gz`);assert.equal(data.year,year);
 for(const p of data.projects){
  seasons++;roles+=p.roles.length;if(!p.roles.length){empty++;continue}
  assert.equal(p.year,year);assert.equal(p.kind,'TV series');assert.ok(shows[p.seriesId]);
  const summary=shows[p.seriesId].seasons.find(x=>x.id===p.id);assert.ok(summary);assert.equal(summary.roles.length,p.roles.length);
  for(const r of summary.roles){assert.equal(p.roles[r.index].character,r.character);assert.equal(p.roles[r.index].personId,r.actorId)}
  const date=projectSchedule(p).castingStart,r=p.roles.find(r=>r.birthYear)||p.roles[0],birthYear=r.birthYear||p.year-35,gender=['male','female','nonbinary'].includes(r.gender)?r.gender:'male';
  const s={date,year:Number(date.slice(0,4)),month:Number(date.slice(5,7)),birthday:`${Math.min(birthYear,Number(date.slice(0,4))-4)}-01-01`,activeId:'self',people:[{id:'self',birthYear,gender}],choices:[],casts:{},filmography:[],projects:[],complete:false};
  assert.deepEqual(available(s,[p]).map(o=>o.index),p.roles.flatMap((r,i)=>genderCompatible(gender,r.gender)&&roleFitForAge(p.year-birthYear,r)>=35?[i]:[]).sort((a,b)=>roleFitForAge(p.year-birthYear,p.roles[b])-roleFitForAge(p.year-birthYear,p.roles[a])||a-b));
 }
}
assert.equal(seasons,index.totals.seasons);assert.equal(roles,index.totals.roles);
const obx=Object.values(shows).find(s=>s.title==='Outer Banks');assert.ok(obx);
assert.ok(obx.seasons.find(s=>s.number===1)?.roles.some(r=>/\bJJ\b/.test(r.character)),'Earlier-season JJ must be playable, unlike the old latest-cast list.');
console.log(JSON.stringify({shows:Object.keys(shows).length,seasons,roles,emptyCastSeasons:empty,startupBytes:fs.statSync('data/tv-seasons/index.json.gz').size}));
