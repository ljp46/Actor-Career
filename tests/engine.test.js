import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCareer,available,audition,advance,generatedYear,haveChild,switchTo,die,ageAt,uniqueName,castFor,buy,datingApp,roleFitForAge,childOpportunityPreview,worldProjects,auditionShortlist,roleFit,genderCompatible,projectSchedule,currentDate,filmingProjects,connect,lifestyle,train} from '../engine.js';
const catalogue=JSON.parse(fs.readFileSync(new URL('../data/sample.json',import.meta.url))).projects;
test('birthday starts exactly at age four and audition commits a timeline cast',()=>{const s=createCareer({name:'Lewis Parry',birthday:'1975-07-19',background:'industry',gender:'male'},catalogue);assert.equal(s.year,1979);assert.equal(s.month,7);assert.equal(ageAt(s.birthday,s.year,s.month),4);s.year=1996;s.month=12;s.date='1996-12-15';const offer=available(s,catalogue).find(o=>o.project.title==='Titanic');assert.ok(offer);s.skills.acting=100;const result=audition(s,catalogue,offer.project,offer.role,offer.index);assert.equal(castFor(s,offer.project,offer.index),result.winner);assert.ok(result.shortlist.some(c=>c.player));assert.ok(result.shortlist.some(c=>c.original));assert.equal(available(s,catalogue).some(x=>x.project.id===offer.project.id),false)});
test('generated future names stay unique across years',()=>{const s=createCareer({name:'A Star',birthday:'2023-01-10',background:'ordinary',gender:'male'},catalogue);for(let y=2027;y<2090;y++)generatedYear(s,y);const titles=s.projects.map(p=>p.title);assert.equal(new Set(titles).size,titles.length);assert.equal(s.projects.length,63*12);const names=[];for(let i=0;i<1000;i++)names.push(uniqueName(s,'person'));assert.equal(new Set(names).size,names.length)});
test('family switching and memorial persist',()=>{const s=createCareer({name:'Sam Vale',birthday:'1980-03-01',background:'ordinary',gender:'male'},catalogue);s.year=2010;const c=haveChild(s,'Aria Vale');s.year=2014;switchTo(s,c.id);assert.equal(s.activeId,c.id);const parent=s.people.find(p=>p.name==='Sam Vale');die(s,parent,'natural causes');assert.equal(s.deathNotices.length,1);assert.equal(s.deathNotices[0].name,'Sam Vale');assert.equal(s.complete,false)});
test('era gates dating apps and purchases consume income',()=>{const s=createCareer({name:'Riley Bell',birthday:'1980-03-10',background:'ordinary',gender:'male'},catalogue);s.year=2005;assert.throws(()=>datingApp(s));s.year=2018;s.money=25000;buy(s,'car');assert.equal(s.money,7000);assert.equal(s.possessions[0].name,'Car');const contact=datingApp(s);assert.equal(contact.occupation,'Other');assert.ok(s.usedPeople.includes(contact.name))});
test('playing-age fit is flexible and childhood preview counts six years',()=>{assert.ok(roleFitForAge(20,{characterAge:16,ageMin:14,ageMax:19})>=60);assert.equal(roleFitForAge(30,{characterAge:16,ageMin:14,ageMax:19}),0);const preview=childOpportunityPreview('1980-06-15',catalogue);assert.ok(preview.total>=3);assert.ok(preview.byYear[1984]>=1);assert.ok(preview.byYear[1985]>=1)});
test('world view and audition shortlist expose the surrounding industry',()=>{const s=createCareer({name:'Lewis Parry',birthday:'1971-06-15',background:'ordinary',gender:'male'},catalogue);s.year=1984;s.month=7;s.date='1984-07-01';const projects=worldProjects(s,catalogue);assert.ok(projects.some(p=>p.title==='The Goonies'));const offer=available(s,catalogue).find(o=>o.project.title==='The Goonies');assert.ok(offer);const list=auditionShortlist(s,catalogue,offer.project,offer.role,offer.index);assert.equal(list.length,5);assert.ok(list.some(c=>c.player));assert.ok(list.some(c=>c.original))});

test('gender is a hard casting constraint and role gender reaches shortlists',()=>{
 const s=createCareer({name:'Lewis Parry',birthday:'1975-07-19',background:'ordinary',gender:'male'},catalogue);
 s.year=1996;s.month=12;s.date='1996-12-15';
 const titanic=catalogue.find(p=>p.title==='Titanic');
 const jack=titanic.roles.find(r=>r.character==='Jack Dawson');
 const rose=titanic.roles.find(r=>r.character==='Rose DeWitt Bukater');
 assert.equal(genderCompatible('male',jack.gender),true);
 assert.equal(genderCompatible('male',rose.gender),false);
 assert.ok(roleFit(s,titanic,jack)>0);
 assert.equal(roleFit(s,titanic,rose),0);
 const offers=available(s,catalogue).filter(o=>o.project.title==='Titanic');
 assert.ok(offers.some(o=>o.role.character==='Jack Dawson'));
 assert.equal(offers.some(o=>o.role.character==='Rose DeWitt Bukater'),false);
 const shortlist=auditionShortlist(s,catalogue,titanic,jack,titanic.roles.indexOf(jack));
 assert.ok(shortlist.every(c=>c.gender==='male'));
});

test('weekly audition closes before filming and a booked role progresses to release',()=>{
 const project=catalogue.find(p=>p.title==='Titanic'),t=projectSchedule(project);
 assert.equal(t.estimated,true);assert.ok(t.castingStart<t.filmingStart&&t.filmingStart<t.filmingEnd&&t.filmingEnd<t.releaseDate);
 let winning;
 for(let i=0;i<40&&!winning;i++){
  const s=createCareer({name:`Actor ${i}`,birthday:'1975-07-19',background:'industry',gender:'male'},catalogue);
  s.date=t.castingStart;s.year=Number(s.date.slice(0,4));s.month=Number(s.date.slice(5,7));s.skills.acting=100;
  const offer=available(s,catalogue).find(o=>o.project.id===project.id&&o.role.character==='Jack Dawson');
  assert.ok(offer);
  if(audition(s,catalogue,offer.project,offer.role,offer.index).win)winning=s
 }
 assert.ok(winning,'a player can win the historical role');
 const s=winning,credit=s.filmography[0];assert.equal(credit.status,'booked');assert.equal(s.money,0);
 while(currentDate(s)<t.filmingStart)advance(s,catalogue);
 assert.equal(credit.status,'filming');assert.ok(filmingProjects(s,catalogue).some(p=>p.id===project.id));
 while(currentDate(s)<t.filmingEnd)advance(s,catalogue);
 assert.equal(credit.status,'post-production');assert.ok(s.money>0);assert.equal(filmingProjects(s,catalogue).length,0);
 while(currentDate(s)<t.releaseDate)advance(s,catalogue);
 assert.equal(credit.status,'released');assert.ok(s.fame>0);
 assert.equal(available(s,catalogue).some(o=>o.project.id===project.id),false);
});

test('social life runs during filming with adult and weekly limits',()=>{
 const s=createCareer({name:'Lewis Parry',birthday:'1975-07-19',background:'ordinary',gender:'male'},catalogue);
 const project=catalogue.find(p=>p.title==='Titanic'),t=projectSchedule(project);
 s.date=t.filmingStart;s.year=Number(s.date.slice(0,4));s.month=Number(s.date.slice(5,7));
 s.filmography.push({personId:s.activeId,projectId:project.id,status:'filming'});
 const name='Kate Winslet';
 s.people.push({id:'co',name,birthYear:1975,relative:'',alive:true});
 assert.equal(connect(s,name,'set',catalogue),true);
 assert.equal(s.relationships[name].friendship,9);
 assert.equal(connect(s,name,'set',catalogue),false,'one interaction per person each week');
 s.relationships[name].chemistry=100;s.relationships[name].friendship=100;
 advance(s,catalogue);
 assert.equal(connect(s,name,'hookup',catalogue),true);
 assert.ok(s.timeline[0].title.includes(name));
 const minor=createCareer({name:'Child',birthday:'1993-07-19',background:'ordinary',gender:'male'},catalogue);
 minor.year=1997;minor.month=7;minor.date='1997-07-19';minor.people.push({id:'adult',name:'Adult Actor',birthYear:1975,relative:'',alive:true});
 assert.equal(connect(minor,'Adult Actor','hookup',catalogue),false);
});

test('weekly lifestyle activities have time and age gates',()=>{
 const s=createCareer({name:'Riley Bell',birthday:'1980-03-10',background:'ordinary',gender:'male'},catalogue);
 assert.throws(()=>lifestyle(s,'nightout'),/adults/);
 lifestyle(s,'rest');train(s,'acting');assert.throws(()=>lifestyle(s,'fitness'),/weekly activity/);
 advance(s,catalogue);lifestyle(s,'fitness');assert.equal(s.weeklyActivities.used,1);
});
