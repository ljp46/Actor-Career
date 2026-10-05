import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,careerStartDate,ageAt,applyCheat,person,familyCasting,projectSchedule,available} from '../engine.js';
const project={id:'fixture',title:'Fixture',year:2001,kind:'Film',director:'Director',releaseDate:'2001-06-01',castingStartDate:'2000-01-01',filmingStartDate:'2000-08-01',filmingEndDate:'2000-10-01',roles:[{actor:'Original',character:'Lead',gender:'male',characterAge:21,ageMin:18,ageMax:30}]};
test('an adult can begin on a chosen day without simulating childhood',()=>{
 const s=createCareer({name:'Adult',birthday:'1980-04-25',startDate:'2000-05-13',gender:'male'},[project]);
 assert.equal(s.date,'2000-05-13');assert.equal(s.year,2000);assert.equal(s.month,5);assert.equal(ageAt(s.birthday,s.year,s.month,13),20);assert.equal(s.filmography.length,0);assert.equal(s.timeline.length,1);assert.match(s.timeline[0].body,/age 20/);assert.equal(available(s,[project]).length,1);
 const earlier=createCareer({name:'Early adult',birthday:'1930-01-01',startDate:'1960-01-01'},[]);assert.equal(earlier.people[0].birthYear,1930);
});
test('start dates reject invalid dates, childhood before four, and unsupported years',()=>{
 for(const startDate of ['1984-02-30','1983-06-15','1959-12-31','2200-01-01'])assert.throws(()=>careerStartDate({birthday:'1980-06-15',startDate}));
 assert.throws(()=>careerStartDate({birthday:'1980-02-30'}));assert.equal(careerStartDate({birthday:'2096-02-29'}),'2100-03-01');
 assert.equal(careerStartDate({birthday:'1980-06-15'}),'1984-06-15');
});
test('each skill and relationship cheat changes only its chosen level and survives save round trip',()=>{
 const s=createCareer({name:'Adult',birthday:'1980-01-01',startDate:'2000-01-01'},[]),p=person(s,'Co-star','Actor',1980,'','female');
 s.relationships[p.name]={friendship:12,respect:14,chemistry:16,dating:false};
 applyCheat(s,'acting');assert.deepEqual(s.skills,{acting:100,drama:5,comedy:5});applyCheat(s,'drama');assert.equal(s.skills.comedy,5);
 assert.equal(applyCheat(s,'friendship',[p.name]),1);assert.equal(s.relationships[p.name].friendship,100);assert.equal(s.relationships[p.name].respect,14);assert.equal(s.relationships[p.name].chemistry,16);
 applyCheat(s,'respect',[p.name]);assert.equal(s.relationships[p.name].chemistry,16);applyCheat(s,'chemistry',[p.name]);assert.equal(s.relationships[p.name].dating,false);
 const loaded=JSON.parse(JSON.stringify(s));assert.equal(loaded.relationships[p.name].chemistry,100);assert.equal(loaded.skills.drama,100);assert.equal(loaded.weeklyActivities,undefined);
});
test('romantic cheats retain age and family restrictions',()=>{
 const s=createCareer({name:'Adult',birthday:'1980-01-01',startDate:'2000-01-01'},[]);
 const minor=person(s,'Minor','Actor',1985,'','female'),relative=person(s,'Relative','Actor',1979,'Sibling','female');
 assert.equal(applyCheat(s,'chemistry',[minor.name,relative.name]),0);assert.equal(applyCheat(s,'friendship',[minor.name]),1);
 s.birthday='1995-01-01';const adult=person(s,'Adult Co-star','Actor',1970,'','female');assert.equal(applyCheat(s,'chemistry',[adult.name]),0);
});
test('family casting stays bounded and never gives two roles in the same production',()=>{
 const projects=Array.from({length:100},(_,i)=>({...project,id:`fixture-${i}`,roles:Array.from({length:20},()=>({...project.roles[0]}))}));
 const s=createCareer({name:'Adult',birthday:'1980-01-01',startDate:'2000-01-01'},[]);
 s.people.slice(1).forEach(p=>p.occupation='Other');const f=person(s,'Family Actor','Actor',1980,'Sibling','male');
 for(let i=0;i<100;i++)familyCasting(s,projects,2001);
 const credits=s.filmography.filter(c=>c.personId===f.id);assert.ok(credits.length<=2);assert.equal(new Set(credits.map(c=>c.projectId)).size,credits.length);
});
test('schedule caching refreshes changed dates and legacy bookings do not reopen auditions',()=>{
 const p={...project},before=projectSchedule(p);assert.equal(projectSchedule(p),before);p.filmingStartDate='2000-09-01';assert.equal(projectSchedule(p).filmingStart,'2000-09-01');
 const s=createCareer({name:'Adult',birthday:'1980-01-01',startDate:'2000-01-01',gender:'male'},[]);assert.equal(available(s,[{...project,legacyOnly:true}]).length,0);
});
