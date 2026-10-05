import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,audition,available,advance,projectSchedule} from '../engine.js';
const p={id:'force-test',title:'Wanted Role',year:2001,kind:'Film',director:'Test Director',castingStartDate:'2000-01-01',filmingStartDate:'2000-08-01',filmingEndDate:'2000-10-01',releaseDate:'2001-06-01',roles:[{actor:'Historical Actor',character:'Lead',birthYear:1980,gender:'male',characterAge:21,ageMin:18,ageMax:25}]};
const career=seed=>{const s=createCareer({name:'Player',birthday:'1980-01-01',startDate:'2000-01-01',gender:'male'},[p]);s.rng=seed;return s};
test('force win guarantees only the selected audition and follows normal production progression',()=>{
 for(let i=0;i<30;i++){
  const s=career(i*100000000),result=audition(s,[p],p,p.roles[0],0,{forceWin:true});
  assert.equal(result.win,true);assert.equal(result.winner,'Player');assert.equal(s.casts['force-test:0'],'Player');assert.equal(s.filmography[0].status,'booked');assert.equal(s.money,0);assert.equal(s.fame,0);assert.equal(s.relationships['Test Director'].respect,8);assert.equal(available(s,[p]).length,0);
 }
 const s=career(5);audition(s,[p],p,p.roles[0],0,{forceWin:true});while(s.date<projectSchedule(p).releaseDate)advance(s,[p]);assert.equal(s.filmography[0].status,'released');assert.ok(s.money>0);assert.ok(s.fame>0);
});
test('ordinary auditions remain chance based after forcing another role',()=>{
 const next={...p,id:'next-role',title:'Next Role',year:2002,castingStartDate:'2001-01-01',filmingStartDate:'2001-08-01',filmingEndDate:'2001-10-01',releaseDate:'2002-06-01'};
 const outcomes=new Set();
 for(let i=0;i<80;i++){
  const s=career(i*50000000);audition(s,[p,next],p,p.roles[0],0,{forceWin:true});s.date='2001-01-01';s.year=2001;s.month=1;
  outcomes.add(audition(s,[p,next],next,next.roles[0],0).win);
 }
 assert.deepEqual(outcomes,new Set([false,true]));
});
test('force win still validates eligibility, closed auditions, and conflicting bookings',()=>{
 const wrong=career(1);wrong.people[0].gender='female';assert.throws(()=>audition(wrong,[p],p,p.roles[0],0,{forceWin:true}));assert.equal(wrong.choices.length,0);
 const closed=career(1);closed.date='2000-08-01';assert.throws(()=>audition(closed,[p],p,p.roles[0],0,{forceWin:true}));
 const s=career(1),overlap={...p,id:'overlap'};audition(s,[p,overlap],p,p.roles[0],0,{forceWin:true});assert.throws(()=>audition(s,[p,overlap],overlap,overlap.roles[0],0,{forceWin:true}));assert.equal(s.filmography.length,1);
});
