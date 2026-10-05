import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {available,roleFitForAge,genderCompatible,castingYear as projectCastingYear} from '../engine.js';
import {readCatalogueResponse} from '../catalogue.js';

const manifest=JSON.parse(fs.readFileSync('data/years/index.json'));
assert.deepEqual(manifest.years,Array.from({length:67},(_,i)=>1960+i));
let productions=0,roles=0,checks=0;
for(const year of manifest.years){
 const packed=fs.readFileSync(`data/years/${year}.json.gz`),raw=gunzipSync(packed);
 assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.files[year].sha256);
 const projects=(await readCatalogueResponse(new Response(packed),true)).projects;
 productions+=projects.length;roles+=projects.reduce((n,p)=>n+p.roles.length,0);
 for(const castingYear of new Set(projects.map(projectCastingYear))){
  for(const gender of ['male','female','nonbinary'])for(const age of [4,12,20,35,55,75]){
   const birthYear=castingYear-age;
   const s={year:castingYear,month:1,birthday:`${birthYear}-01-01`,activeId:'self',people:[{id:'self',birthYear,gender}],choices:[],casts:{},filmography:[],projects:[],complete:false};
   const expected=new Set();
   for(const p of projects)if(projectCastingYear(p)===castingYear)p.roles.forEach((r,i)=>{
    if(genderCompatible(gender,r.gender)&&roleFitForAge(p.year-birthYear,r)>=35)expected.add(`${p.id}:${i}`)
   });
   const found=available(s,projects);
   assert.deepEqual(new Set(found.map(o=>`${o.project.id}:${o.index}`)),expected,`Every eligible role must be reachable in ${year}, ${gender}, age ${age}`);
   checks++;
  }
 }
 console.log(`Validated ${year}: ${projects.length} films/TV shows`);
}
assert.equal(productions,manifest.totals.projects);assert.equal(roles,manifest.totals.roles);
console.log(JSON.stringify({years:67,productions,roles,castingProfilesChecked:checks}));
