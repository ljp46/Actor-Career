import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {available,roleFitForAge,genderCompatible,projectSchedule} from '../engine.js';
import {readCatalogueResponse} from '../catalogue.js';

const manifest=JSON.parse(fs.readFileSync('data/years/index.json'));
assert.deepEqual(manifest.years,Array.from({length:67},(_,i)=>1960+i));
let productions=0,roles=0,checks=0;
for(const year of manifest.years){
 const packed=fs.readFileSync(`data/years/${year}.json.gz`),raw=gunzipSync(packed);
 assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.files[year].sha256);
 const projects=(await readCatalogueResponse(new Response(packed),true)).projects;
 productions+=projects.length;roles+=projects.reduce((n,p)=>n+p.roles.length,0);
 for(const project of projects){
  const schedule=projectSchedule(project),date=schedule.castingStart,yearAtCasting=Number(date.slice(0,4));
  assert.ok(date>='1960-01-01'&&date<schedule.castingEnd&&schedule.filmingStart<schedule.filmingEnd&&schedule.filmingEnd<schedule.releaseDate);
  const first=project.roles[0],target=first.characterAge??Math.round((first.ageMin+first.ageMax)/2);
  const birthYear=Math.min(project.year-target,yearAtCasting-4),gender=['male','female','nonbinary'].includes(first.gender)?first.gender:'male';
  const s={year:yearAtCasting,month:Number(date.slice(5,7)),date,birthday:`${birthYear}-01-01`,activeId:'self',people:[{id:'self',birthYear,gender}],choices:[],casts:{},filmography:[],projects:[],complete:false};
  const expected=new Set(project.roles.flatMap((r,i)=>genderCompatible(gender,r.gender)&&roleFitForAge(project.year-birthYear,r)>=35?[i]:[]));
  assert.deepEqual(new Set(available(s,[project]).map(o=>o.index)),expected,`Every eligible role is reachable when casting opens: ${project.id}`);
  checks++;
 }
 console.log(`Validated ${year}: ${projects.length} films/TV shows`);
}
assert.equal(productions,manifest.totals.projects);assert.equal(roles,manifest.totals.roles);
console.log(JSON.stringify({years:67,productions,roles,productionsWithCastingWindowsChecked:checks}));
