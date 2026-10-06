import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,available,advance,generatedYear,projectSchedule,applyCheat,familyCasting} from '../engine.js';
import {ensureCareer,careerProfile,prepareAudition,startAudition,attendCallback,pendingOffers,acceptCareerOffer,declineCareerOffer,negotiateOffer,hireAgent,searchAgentOffers,franchisePlan,reservations,terminateContract,careerTick,onSetAction,resolveProductionEvent,characterKey} from '../career.js';

const role={actor:'Historical Star',character:'Alex Vale',gender:'male',birthYear:1980,characterAge:21,ageMin:18,ageMax:30};
const film=(id,year,character='Alex Vale')=>({id,title:`Film ${id}`,year,kind:'Film',genre:'Drama',director:'Test Director',collectionId:'collection',castingStartDate:`${year-1}-01-01`,filmingStartDate:`${year-1}-08-01`,filmingEndDate:`${year-1}-10-01`,releaseDate:`${year}-06-01`,roles:[{...role,character,characterAge:year-1980,ageMin:year-1980-5,ageMax:year-1980+9},{...role,actor:'Co-star',character:'Casey Reed',gender:'female'}]});
const first=film('first',2001),second=film('second',2003),third=film('third',2005),data={collections:{collection:{name:'Test Collection',parts:[first,second,third]}},projectCollections:{first:'collection',second:'collection',third:'collection'}};
const catalogue=[first,second,third];
const make=()=>{const s=createCareer({name:'Player',birthday:'1980-01-01',startDate:'2000-01-01',gender:'male'},catalogue);ensureCareer(s);return s};
const forceOffer=(s,p=first,c=catalogue)=>startAudition(s,c,p,0,{forceWin:true}).offer;

test('background family casting respects contract reservations and pending decisions',()=>{
 for(let seed=0;seed<50;seed++){
  const s=make();acceptCareerOffer(s,catalogue,forceOffer(s).id,data,{multiFilm:true});s.people.push({id:'family-actor',name:'Family Actor',relative:'Sibling',occupation:'Actor',birthYear:1980,gender:'male',alive:true});
  s.rng=seed*40000000;familyCasting(s,catalogue,2003);assert.equal(s.casts['second:0'],undefined);
  const other=make();forceOffer(other);other.people.push({id:'family-actor',name:'Family Actor',relative:'Sibling',occupation:'Actor',birthYear:1980,gender:'male',alive:true});other.rng=seed*40000000;familyCasting(other,catalogue,2001);assert.equal(other.casts['first:0'],undefined);
 }
});

test('wrapped productions cannot keep an open on-set dilemma',()=>{
 const s=make(),credit=acceptCareerOffer(s,catalogue,forceOffer(s).id,data).credit;
 credit.status='post-production';s.productionEvents.push({id:'old-event',projectId:first.id,personId:s.activeId,status:'open',createdOn:s.date});
 assert.throws(()=>resolveProductionEvent(s,'old-event','rest'),/no longer filming/);careerTick(s,catalogue,data);assert.equal(s.productionEvents[0].status,'expired');
});

test('force win is a guaranteed but non-binding offer until accepted',()=>{
 const s=make(),o=forceOffer(s);assert.equal(s.filmography.length,0);assert.equal(s.money,0);assert.equal(s.casts['first:0'],undefined);
 assert.equal(available(s,catalogue).some(o=>o.project.id===first.id&&o.index===0),false);
 const {credit}=acceptCareerOffer(s,catalogue,o.id,data);assert.equal(credit.status,'booked');assert.equal(s.casts['first:0'],'Player');assert.equal(s.contracts.length,0);assert.equal(s.money,0);assert.equal(s.worldChanges[0].performer,'Player');
 assert.throws(()=>acceptCareerOffer(s,catalogue,o.id,data));
});
test('preparation consumes weekly time, coaching consumes money, and callbacks have dates',()=>{
 let found;
 for(let i=0;i<50&&!found;i++){const s=make();s.rng=i*40000000;applyCheat(s,'acting');applyCheat(s,'drama');prepareAudition(s,catalogue,first,0);prepareAudition(s,catalogue,first,0);prepareAudition(s,catalogue,first,0);assert.equal(s.energy,55);const result=startAudition(s,catalogue,first,0);if(result.stage==='callback')found={s,a:result.callback}}
 assert.ok(found);const {s,a}=found;assert.throws(()=>attendCallback(s,catalogue,a.id),/not ready/);advance(s,catalogue);s.money=500;prepareAudition(s,catalogue,first,0,'coach');assert.equal(s.money,0);
 const outcome=attendCallback(s,catalogue,a.id,{forceWin:true});assert.equal(outcome.stage,'offer');assert.equal(s.filmography.length,0);acceptCareerOffer(s,catalogue,outcome.offer.id,data);assert.equal(s.filmography.length,1);
});
test('normal career auditions still produce callbacks, rejections, offers and final losses',()=>{
 const initial=new Set(),final=new Set();
 for(let i=0;i<150;i++){const s=make();s.rng=i*25000000;const result=startAudition(s,catalogue,first,0);initial.add(result.stage);if(result.stage!=='callback')continue;advance(s,catalogue);final.add(attendCallback(s,catalogue,result.callback.id).stage)}
 assert.ok(initial.has('callback')&&initial.has('rejected'));assert.ok(final.has('offer')&&final.has('rejected'));
});
test('competing offers stay non-binding, but accepting an overlapping shoot blocks another',()=>{
 const other={...first,id:'other'},c=[first,other],s=make(),a=forceOffer(s,first,c),b=forceOffer(s,other,c);assert.equal(pendingOffers(s).length,2);
 acceptCareerOffer(s,c,a.id,data);assert.throws(()=>acceptCareerOffer(s,c,b.id,data),/conflicts/);assert.equal(pendingOffers(s).find(o=>o.id===b.id).status,'offered');declineCareerOffer(s,b.id);assert.equal(careerProfile(s).reputation,60);
});
test('agents scout competing offers and agreed commission is paid at wrap even after leaving',()=>{
 const s=make(),other={...first,id:'other'},c=[first,other];hireAgent(s,1);applyCheat(s,'acting');assert.equal(searchAgentOffers(s,c),2);assert.throws(()=>searchAgentOffers(s,c),/already searched/);
 const o=pendingOffers(s)[0];negotiateOffer(s,o.id);if(o.status==='withdrawn')return;const {credit}=acceptCareerOffer(s,c,o.id,data);hireAgent(s,0);const expected=Math.round(credit.fee*.9);
 while(s.date<projectSchedule(first).filmingEnd)advance(s,c);assert.equal(credit.status,'post-production');assert.equal(s.money,expected);
});
test('forced offers cannot disappear during negotiation and levels are independently gated',()=>{
 const s=make(),o=forceOffer(s);negotiateOffer(s,o.id);assert.equal(o.status,'offered');assert.throws(()=>negotiateOffer(s,o.id),/already/);assert.throws(()=>hireAgent(s,3),/not ready/);s.fame=50;s.respect=30;hireAgent(s,3);assert.equal(careerProfile(s).agent.level,3);
});
test('a multi-film deal reserves exact returning roles and blocks incompatible jobs',()=>{
 const s=make(),o=forceOffer(s);const {contract}=acceptCareerOffer(s,catalogue,o.id,data,{multiFilm:true});assert.equal(contract.entries.length,2);assert.equal(reservations(s).length,2);assert.equal(s.filmography.length,1);
 s.date='2002-01-01';s.year=2002;const competing={...second,id:'competing'},c=[...catalogue,competing];assert.equal(available(s,c).some(o=>o.project.id===competing.id),false);careerTick(s,c,data);const returnOffer=pendingOffers(s).find(o=>o.contractId===contract.id);assert.ok(returnOffer);assert.equal(returnOffer.projectId,second.id);
 acceptCareerOffer(s,c,returnOffer.id,data);assert.equal(s.casts['second:0'],'Player');assert.equal(contract.entries[0].status,'booked');
});
test('refusal and missing a required return terminate once and damage future reputation',()=>{
 const s=make();const {contract}=acceptCareerOffer(s,catalogue,forceOffer(s).id,data,{multiFilm:true});s.date='2002-01-01';s.year=2002;careerTick(s,catalogue,data);declineCareerOffer(s,pendingOffers(s).find(o=>o.contractId).id);assert.equal(contract.status,'terminated');assert.equal(careerProfile(s).reputation,42);assert.equal(reservations(s).length,0);assert.throws(()=>terminateContract(s,contract.id));
 const missed=make();const deal=acceptCareerOffer(missed,catalogue,forceOffer(missed).id,data,{multiFilm:true}).contract;missed.date='2002-08-01';missed.year=2002;careerTick(missed,catalogue,data);assert.equal(deal.status,'terminated');
});
test('fulfilling the final return completes the deal and expired ordinary offers do not penalise reputation',()=>{
 const s=make();const {contract}=acceptCareerOffer(s,catalogue,forceOffer(s).id,data,{multiFilm:true});
 for(const [p,y] of [[second,2002],[third,2004]]){s.date=`${y}-01-01`;s.year=y;careerTick(s,catalogue,data);acceptCareerOffer(s,catalogue,pendingOffers(s).find(o=>o.contractId).id,data);s.filmography.find(f=>f.projectId===p.id).status='released'}
 careerTick(s,catalogue,data);assert.equal(contract.status,'completed');assert.equal(reservations(s).length,0);
 const ordinary=make();forceOffer(ordinary);ordinary.date='2000-02-01';ordinary.month=2;careerTick(ordinary,catalogue,data);assert.equal(pendingOffers(ordinary).length,0);assert.equal(careerProfile(ordinary).reputation,60);
});
test('a character absent from a sequel is never promised, and generic extras do not get deals',()=>{
 const s=make(),different=film('missing',2003,'Someone Else'),d={collections:{collection:{parts:[first,different]}}};assert.equal(franchisePlan(s,first,0,d).length,0);
 const extra=film('extra',2001,'Guard'),more=film('more',2003,'Guard');assert.equal(franchisePlan(s,extra,0,{collections:{collection:{parts:[extra,more]}}}).length,0);assert.equal(characterKey('Shrek (voice)'),'shrek');
});
test('generated deals only create sequels on signing and do not prevent a full generated year',()=>{
 const s=make(),p={...first,id:'future-first',title:'Future Film',year:2027,collectionId:null,generated:true,castingStartDate:'2026-01-01',filmingStartDate:'2026-08-01',filmingEndDate:'2026-10-01',releaseDate:'2027-06-01',roles:[{...role,characterAge:47,ageMin:40,ageMax:60}]};s.date='2026-01-01';s.year=2026;s.projects=[p];const c=[p],d={collections:{},projectCollections:{}};
 assert.equal(franchisePlan(s,p,0,d).length,2);assert.equal(s.projects.length,1);const o=forceOffer(s,p,c);acceptCareerOffer(s,c,o.id,d,{multiFilm:true});assert.equal(s.projects.length,3);generatedYear(s,2029);assert.equal(s.projects.filter(p=>p.year===2029).length,13);
});
test('on-set work affects teamwork and performance, dilemmas give reasons to leave, outcomes happen once',()=>{
 const s=make(),{credit,contract}=acceptCareerOffer(s,catalogue,forceOffer(s).id,data,{multiFilm:true});s.date='2000-08-01';s.month=8;credit.status='filming';onSetAction(s,catalogue,first.id,'teamwork');onSetAction(s,catalogue,first.id,'rehearse');assert.equal(credit.performance.teamwork,5);assert.equal(s.relationships['Co-star'].respect,6);onSetAction(s,catalogue,first.id,'rehearse');assert.equal(s.energy,55);
 s.productionEvents.push({id:'dilemma',projectId:first.id,personId:s.activeId,status:'open'});resolveProductionEvent(s,'dilemma','pushback');assert.equal(contract.unfairDemands,true);terminateContract(s,contract.id,'unfair demands');assert.equal(careerProfile(s).reputation,53);
 credit.status='released';s.date='2001-06-01';s.year=2001;careerTick(s,catalogue,data);assert.ok(credit.outcome?.fictional);const fame=s.fame,rep=careerProfile(s).reputation;careerTick(s,catalogue,data);assert.equal(s.fame,fame);assert.equal(careerProfile(s).reputation,rep);
});
test('old saves migrate without retroactive release rewards and career state survives export',()=>{
 const s=createCareer({name:'Old Save',birthday:'1980-01-01',startDate:'2000-01-01',gender:'male'},catalogue);s.filmography.push({projectId:'old',status:'released',personId:s.activeId,title:'Old release'});ensureCareer(s);assert.equal(s.filmography[0].legacyOutcome,true);hireAgent(s,1);const o=forceOffer(s);const restored=JSON.parse(JSON.stringify(s));assert.equal(pendingOffers(restored)[0].id,o.id);assert.equal(careerProfile(restored).agent.level,1);
});
