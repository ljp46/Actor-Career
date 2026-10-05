import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {franchisePlan,characterKey} from '../career.js';

const read=path=>JSON.parse(gunzipSync(fs.readFileSync(path)));
const data=read('data/franchises.json.gz');
assert.equal(data.selectedFilmsChecked,6700);
assert.ok(fs.statSync('data/franchises.json.gz').size<600000,'The startup index must stay small.');
const selected=new Map();
for(let year=1960;year<=2026;year++)for(const p of read(`data/years/${year}.json.gz`).projects)selected.set(p.id,p);
let parts=0,links=0,dealExamples=0;
for(const [id,collection] of Object.entries(data.collections)){
 assert.equal(String(collection.id),id);
 for(const part of collection.parts){
  parts++;assert.equal(data.projectCollections[part.id],id);
  const full=selected.get(part.id)||read(`data/franchise-projects/${part.id}.json.gz`).project;
  assert.equal(full.id,part.id);assert.equal(full.year,part.year);assert.equal(full.title,part.title);
  for(const link of part.roles){assert.equal(full.roles[link.index]?.character,link.character);assert.equal(full.roles[link.index]?.actor,link.actor);links++}
  if(!selected.has(part.id)||!part.roles.length)continue;
  const first=part.roles.find(r=>characterKey(r.character).split(' ').length>=2)||part.roles[0],gender=['male','female','nonbinary'].includes(first.gender)?first.gender:'male';
  const s={activeId:'self',people:[{id:'self',gender}],projects:[],customCollections:{}};
  const plans=franchisePlan(s,{...full,collectionId:id},first.index,data);
  for(const plan of plans){assert.equal(characterKey(plan.character),characterKey(first.character));assert.ok(plan.project.releaseDate>full.releaseDate)}
  if(plans.length)dealExamples++;
 }
}
console.log(JSON.stringify({collections:Object.keys(data.collections).length,linkedParts:parts,verifiedRoleLinks:links,selectedFilmsWithSampleDeals:dealExamples}));
