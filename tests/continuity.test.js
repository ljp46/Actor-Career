import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,available,projectSchedule,generatedYear,advance} from '../engine.js';
import {ensureCareer,startAudition,acceptCareerOffer,pendingOffers,declineCareerOffer,leaveSeries} from '../career.js';
import {attachSeasons,characterExit,continuityTick,migrateSeriesCareers} from '../continuity.js';

const role={character:'Alex Vale',actor:'Original Actor',personId:10,gender:'male',birthYear:1980,characterAge:21,ageMin:18,ageMax:40,roleType:'recurring',episodeCount:10};
const season=(number,year,roles=[role])=>({id:`show-season-${number}`,seriesId:'show',seriesTitle:'The Show',title:`The Show · Season ${number}`,seasonNumber:number,year,releaseDate:`${year}-06-01`,kind:'TV series',genre:'Drama',director:'Director',roles,castingStartDate:`${year-1}-01-01`,filmingStartDate:`${year-1}-08-01`,filmingEndDate:`${year-1}-10-01`});
const first=season(1,2001),second=season(2,2003),third=season(3,2005),catalogue=[first,second,third];
const summary=p=>({...p,number:p.seasonNumber,roles:p.roles.map((r,index)=>({index,character:r.character,actorId:r.personId,roleType:r.roleType}))});
const shows={show:{id:'show',title:'The Show',status:'Ended',seasons:catalogue.map(summary)}};
const make=()=>{const s=createCareer({name:'Player',birthday:'1980-01-01',startDate:'2000-01-01',gender:'male'},catalogue);ensureCareer(s);return s};
const accept=(s,p=first,c=catalogue)=>acceptCareerOffer(s,c,startAudition(s,c,p,0,{forceWin:true}).offer.id,{collections:{},projectCollections:{}}).credit;
const wrap=(s,credit,date='2002-01-01',performance=40)=>{credit.status='released';credit.skillsAtWrap={acting:performance,drama:performance,comedy:performance};credit.outcome={performance,reception:50};s.date=date;s.year=Number(date.slice(0,4));s.month=Number(date.slice(5,7))};

test('season casts replace series launch credits but do not erase unrelated films',()=>{
 const index={shows:{show:{id:'show',seasons:[{number:1}]}}};
 assert.deepEqual(attachSeasons([{id:'show'},{id:'film'}],index,[first]).map(p=>p.id),['film',first.id]);
});
test('accepting a TV part creates a recurring career and the next season is an offer, not an audition',()=>{
 const s=make(),credit=accept(s);assert.equal(s.tvCareers.length,1);assert.equal(credit.seasonNumber,1);
 wrap(s,credit);continuityTick(s,catalogue,{shows});const offer=pendingOffers(s)[0];assert.equal(offer.source,'tv-return');assert.equal(offer.projectId,second.id);assert.equal(s.filmography.length,1);
 assert.equal(available(s,catalogue).some(o=>o.project.id===second.id&&o.role.character===role.character),false);
 acceptCareerOffer(s,catalogue,offer.id,{collections:{},projectCollections:{}});assert.equal(s.tvCareers.length,1);assert.equal(s.tvCareers[0].lastSeason,2);assert.equal(s.filmography.length,2);
});
test('absent characters end their run without inventing a death; ambiguous matches are not promised',()=>{
 for(const roles of [[],[{...role,character:'Someone Else'}],[role,{...role,actor:'Double'}]]){
  const c=[first,season(2,2003,roles)],s=make(),credit=accept(s,first,c);wrap(s,credit);
  continuityTick(s,c,{shows:{show:{...shows.show,seasons:c.map(summary)}}});
  assert.equal(s.tvCareers[0].status,roles.length!==1?'unverified':'written-out');assert.equal(pendingOffers(s).length,0);assert.ok(!s.timeline[0].body.includes('death'));
 }
});
test('verified deaths override a later credit, while audience support can persistently change the script',()=>{
 const overrides={exits:[{seriesId:'show',characters:['Alex Vale'],afterSeason:1,type:'death'}]};
 const ordinary=make(),credit=accept(ordinary);wrap(ordinary,credit);continuityTick(ordinary,catalogue,{shows,overrides});assert.equal(ordinary.tvCareers[0].status,'written-out');assert.ok(ordinary.timeline[0].body.includes('death'));
 let survived;
 for(let i=0;i<50&&!survived;i++){const s=make(),credit=accept(s);wrap(s,credit,'2002-01-01',100);s.tvCareers[0].fans=100;s.rng=i*40000000;continuityTick(s,catalogue,{shows,overrides});if(pendingOffers(s).length)survived=s}
 assert.ok(survived);assert.equal(pendingOffers(survived)[0].source,'alternate-return');const before=JSON.stringify(survived.continuityDecisions);continuityTick(survived,catalogue,{shows,overrides});assert.equal(JSON.stringify(survived.continuityDecisions),before);assert.equal(pendingOffers(survived).length,1);
});
test('strong performances can extend a cancelled series into explicitly alternate seasons',()=>{
 let renewed;
 for(let i=0;i<50&&!renewed;i++){const s=make(),credit=accept(s);wrap(s,credit,'2001-07-01',100);s.rng=i*40000000;continuityTick(s,[first],{shows:{show:{...shows.show,status:'Canceled',seasons:[summary(first)]}}});if(s.projects.some(p=>p.alternateSeason))renewed=s}
 assert.ok(renewed);assert.equal(renewed.showChanges.show.status,'renewed');assert.ok(renewed.projects.find(p=>p.alternateSeason).title.includes('alternate timeline'));assert.equal(first.title,'The Show · Season 1');
});
test('leaving and declining a return ends the recurring role and can cause earlier cancellation',()=>{
 let cancelled;
 for(let i=0;i<50&&!cancelled;i++){const s=make(),credit=accept(s);wrap(s,credit,'2002-01-01',100);s.tvCareers[0].fans=100;s.rng=i*40000000;continuityTick(s,catalogue,{shows});declineCareerOffer(s,pendingOffers(s)[0].id);assert.equal(s.tvCareers[0].status,'left');continuityTick(s,catalogue,{shows});if(s.showChanges.show?.status==='cancelled')cancelled=s}
 assert.ok(cancelled);assert.equal(available(cancelled,catalogue).length,0);
});
test('old series bookings migrate once without changing money or replaying a paid credit',()=>{
 const s=make(),legacy={...first,id:'show',seriesId:undefined,seasonNumber:undefined};
 s.filmography.push({projectId:'show',title:'The Show',year:2001,kind:'TV series',role:role.character,personId:'self',status:'released',fee:28000});s.money=1234;
 migrateSeriesCareers(s,[legacy],shows);migrateSeriesCareers(s,[legacy],shows);assert.equal(s.tvCareers.length,1);assert.equal(s.money,1234);assert.equal(s.filmography.length,1);assert.equal(s.filmography[0].projectId,'show');
});
test('generated TV shows continue in future seasons without blocking new world generation',()=>{
 const s=make();generatedYear(s,2027);const p=s.projects.find(p=>p.kind==='TV series');assert.equal(p.seasonNumber,1);assert.equal(p.seriesId,p.id);
});
test('a character absent from a film sequel can gain an alternate appearance without mutating the real cast',()=>{
 const a={...first,id:'film-first',kind:'Film',seriesId:undefined,collectionId:'films'},b={...second,id:'film-second',kind:'Film',seriesId:undefined,collectionId:'films',roles:[{...role,character:'Other'}]},c=[a,b];
 let returned;
 for(let i=0;i<50&&!returned;i++){const s=make(),credit=accept(s,a,c);wrap(s,credit,'2002-01-01',100);s.rng=i*40000000;continuityTick(s,c,{franchises:{collections:{films:{parts:[summary(a),summary(b)]}}}});if(pendingOffers(s).length)returned=s}
 assert.ok(returned);assert.equal(b.roles.length,1);assert.equal(returned.projects.find(p=>p.id===b.id).roles.length,2);assert.equal(pendingOffers(returned)[0].source,'alternate-return');
});
