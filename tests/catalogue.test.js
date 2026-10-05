import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {available,createCareer,auditionShortlist} from '../engine.js';
import {auditionPage,mergeCatalogue,readCatalogueResponse} from '../catalogue.js';

const projects=Array.from({length:55},(_,i)=>({id:`production-${i}`,title:`Production ${String(i).padStart(2,'0')}`,year:2001,kind:i%2?'Film':'TV series',director:'A Director',roles:[{character:`Character ${i}`,actor:`Actor ${i}`,gender:'male',characterAge:21,ageMin:15,ageMax:30}]}));
const career=()=>{const s=createCareer({name:'Test Actor',birthday:'1980-01-01',gender:'male',background:'ordinary'},[]);s.year=2000;return s};
test('all eligible films and TV roles are reachable beyond the old twelve-role cap',()=>{
 const offers=available(career(),projects);assert.equal(offers.length,55);
 const pages=[];for(let page=0;page<3;page++)pages.push(...auditionPage(offers,{page}).offers);
 assert.deepEqual(new Set(pages.map(o=>o.project.id)),new Set(projects.map(p=>p.id)));
 assert.equal(auditionPage(offers,{query:'Character 54'}).offers[0].project.id,'production-54');
 assert.equal(auditionPage(offers,{query:'Production 53',kind:'Film'}).total,1);
 assert.equal(auditionPage(offers,{query:'Production 53',kind:'TV series'}).total,0);
});
test('fit, casting year, gender, decided roles and existing credits still apply',()=>{
 const s=career();s.choices=['production-0:0'];s.casts['production-1:0']='Other Actor';s.filmography=[{projectId:'production-2',personId:'self'}];
 const extra=[{...projects[0],id:'wrong-age',roles:[{...projects[0].roles[0],characterAge:70}]},{...projects[0],id:'wrong-gender',roles:[{...projects[0].roles[0],gender:'female'}]},{...projects[0],id:'wrong-year',castingYear:1999}];
 assert.equal(available(s,[...projects,...extra]).length,52);
});
test('different productions with identical titles survive catalogue loading',()=>{
 const a={...projects[0],title:'Shared Title'},b={...projects[1],title:'Shared Title'};
 assert.equal(mergeCatalogue([a],[b]).length,2);assert.equal(mergeCatalogue([a],[{...a,director:'Updated'}]).length,1);
});
test('compressed browser loader preserves the complete production payload',async()=>{
 const payload={year:2001,projects};assert.deepEqual(await readCatalogueResponse(new Response(gzipSync(JSON.stringify(payload))),true),payload);
 await assert.rejects(readCatalogueResponse(new Response('Not found',{status:404}),true));
});
test('shortlists do not repeat performers appearing in multiple productions',()=>{
 const duplicated=projects.map((p,i)=>({...p,roles:[{...p.roles[0],actor:i<20?'Repeated Performer':p.roles[0].actor}]}));
 const list=auditionShortlist(career(),duplicated,projects[0],projects[0].roles[0],0);
 assert.equal(list.length,5);assert.equal(new Set(list.map(c=>c.name)).size,5);
});
test('1960 productions can be auditioned in the earliest playable year',()=>{
 const s=createCareer({name:'First Year',birthday:'1956-01-01',gender:'male',background:'ordinary'},[]);
 const first={...projects[0],year:1960,castingYear:1959,roles:[{...projects[0].roles[0],characterAge:4,ageMin:4,ageMax:10}]};
 assert.equal(available(s,[first]).length,1);
});
