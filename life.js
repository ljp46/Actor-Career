// v1.7 life simulation: wellbeing, health, ageing, death, legacy, activities,
// pets and random life events. All events are fictional gameplay.
import {active,person,uniqueName,die,switchTo,currentDate} from './engine.js?v=17';
import {bond,personAge,romanceAllowed} from './relationships.js?v=17';
import {limit,feed,queueEvent,openLifeEvent,dateOf,plusDays,daysBetween,random,eraValue,ensureOverhaul,calendarReason,reserve,fingerprint,assets} from './game-rules.js?v=17';
import {careerProfile} from './career.js?v=17';

export const LIFE_VERSION=1;
const roll=s=>random(s);
const pickOne=(s,list)=>list[Math.floor(roll(s)*list.length)];
const cash=(s,n)=>Math.round(n*eraValue(s.year));
const fmtCash=n=>'$'+Math.round(n).toLocaleString('en-US');
const choice=(id,label)=>({id,label});

// ---------------------------------------------------------------- stats
export function ensureLife(s){
 s.lifeStats??={};s.conditions??=[];s.legacies??=[];s.lifeVersion??=LIFE_VERSION;s.pets??=[];
 const a=active(s);if(!a)return null;
 const h=fingerprint(a.name+(a.birthYear||''));
 const st=s.lifeStats[a.id]??={happiness:72,looks:35+h%56,health:s.health??92,peakFame:s.fame||0,lastTick:dateOf(s),born:s.birthday};
 st.peakFame=Math.max(st.peakFame||0,s.fame||0);
 return st;
}
export function lifeStats(s){const st=ensureLife(s);return {happiness:Math.round(st.happiness),health:Math.round(s.health),looks:Math.round(st.looks),fame:Math.round(s.fame),acting:Math.round(s.skills?.acting||0)}}
export function nudge(s,{happiness=0,health=0,looks=0}={}){const st=ensureLife(s);st.happiness=limit(st.happiness+happiness);st.looks=limit(st.looks+looks);s.health=limit(s.health+health,0,100)}
export const ageOf=s=>personAge(s,active(s));

// -------------------------------------------------------------- health
export const conditionTypes={
 cold:{name:'A heavy cold',health:1,happiness:1,weeks:2,cost:60,cure:.95},
 flu:{name:'Flu',health:3,happiness:2,weeks:3,cost:120,cure:.9},
 bronchitis:{name:'Bronchitis',health:4,happiness:2,weeks:6,cost:300,cure:.85},
 sprain:{name:'A sprained ankle',health:2,happiness:2,weeks:4,cost:250,cure:.9,injury:true},
 fracture:{name:'A broken arm',health:3,happiness:3,weeks:8,cost:2500,cure:.95,injury:true},
 back:{name:'Chronic back pain',health:1,happiness:2,cost:900,cure:.45,minAge:30},
 migraine:{name:'Migraines',health:1,happiness:3,cost:400,cure:.6},
 anxiety:{name:'Anxiety',health:1,happiness:4,cost:800,cure:.55,minAge:13},
 burnout:{name:'Burnout',health:2,happiness:5,weeks:10,cost:1500,cure:.6,minAge:18},
 bloodpressure:{name:'High blood pressure',health:1,happiness:0,cost:600,cure:.5,minAge:38},
 heart:{name:'Heart disease',health:3,happiness:2,cost:40000,cure:.35,minAge:50,serious:true},
 cancer:{name:'Cancer',health:5,happiness:4,cost:120000,cure:.45,minAge:40,serious:true},
};
export const conditionsOf=s=>s.conditions.filter(c=>c.personId===s.activeId&&c.status==='active');
export function contract(s,type,{silent=false}={}){
 const t=conditionTypes[type];if(!t||conditionsOf(s).some(c=>c.type===type))return null;
 const c={id:`condition-${s.nextId++}`,personId:s.activeId,type,name:t.name,since:dateOf(s),until:t.weeks?plusDays(dateOf(s),t.weeks*7):null,status:'active'};
 s.conditions.push(c);if(!silent)feed(s,'A diagnosis',`${t.name}. ${t.weeks?'It should pass with rest, or a doctor can help.':'This will not go away on its own.'}`);return c;
}
function recover(s,c,how){c.status='recovered';c.recoveredOn=dateOf(s);feed(s,'Recovered',`${c.name} is behind you${how?` ${how}`:''}.`)}
export function treat(s,id){
 const c=conditionsOf(s).find(c=>c.id===id),t=c&&conditionTypes[c.type];if(!c)throw Error('That condition has already cleared up.');
 const price=cash(s,t.cost);if(s.money<price)throw Error(`Treatment costs ${fmtCash(price)}.`);
 s.money-=price;
 if(roll(s)<t.cure+(c.treatments||0)*.08){recover(s,c,'after treatment');nudge(s,{happiness:6,health:6});return {title:'Treatment worked',body:`${t.name} is gone. You paid ${fmtCash(price)}.`}}
 c.treatments=(c.treatments||0)+1;nudge(s,{happiness:-3});
 return {title:'Not this time',body:`The treatment for ${t.name.toLowerCase()} did not work yet (${fmtCash(price)}). Another attempt has a better chance.`};
}

// Annual mortality roughly following a Gompertz curve, scaled by health.
export function annualMortality(age,health){
 const base=age<1?.004:age<15?.0002:.00045*Math.exp(.088*(age-30));
 return Math.min(.95,base*(.45+Math.pow((100-health)/45,2)));
}

// ------------------------------------------------------------ the tick
export function lifeTick(s,catalogue,{days=7}={}){
 if(s.complete)return;const st=ensureLife(s),a=active(s),date=dateOf(s),age=personAge(s,a);
 const weeks=Math.max(1,days/7);
 // Conditions
 for(const c of conditionsOf(s)){
  const t=conditionTypes[c.type];
  if(c.until&&date>=c.until){recover(s,c,'with time');continue}
  s.health=limit(s.health-t.health*weeks*.5,0,100);st.happiness=limit(st.happiness-t.happiness*weeks*.35);
 }
 // Ageing
 if(age>=45)s.health=limit(s.health-(age-40)*.012*weeks,0,100);
 if(age>=35&&roll(s)<.08*weeks)st.looks=limit(st.looks-.4);
 if(age<30&&s.health<95)s.health=limit(s.health+.6*weeks,0,100);
 // Happiness drifts towards a target shaped by your life
 const life=ensureOverhaul(s),owned=(s.possessions||[]).filter(p=>p.ownerId===s.activeId),pets=s.pets.filter(p=>p.ownerId===s.activeId&&p.alive);
 const partner=Object.values(s.relationships||{}).find(r=>r.dating&&!r.affair);
 const target=limit(52+(partner?10+(partner.status==='married'?4:0)-(partner.tension||0)/10:0)+Math.min(10,pets.length*5)+(owned.some(p=>assetKind(p.id)==='home')?5:0)+(life.lifestyle==='luxury'?6:life.lifestyle==='comfortable'?3:0)-(life.debt>0?12:0)-conditionsOf(s).length*6+(s.health<40?-10:0)+Math.min(8,(s.fame||0)/12)+(s.energy<20?-4:0));
 st.happiness=limit(st.happiness+(target-st.happiness)*.06*weeks);
 st.peakFame=Math.max(st.peakFame||0,s.fame||0);
 // New illnesses and injuries
 if(roll(s)<.012*weeks*(s.health<50?2:1)){const pool=Object.entries(conditionTypes).filter(([k,t])=>!t.injury&&age>=(t.minAge||0)&&!t.serious);const [type]=pickOne(s,pool);const c=contract(s,type,{silent:true});if(c)healthEvent(s,c)}
 if(age>=40&&roll(s)<.0009*weeks*(1+(age-40)/12)*(s.health<60?2:1)){const [type]=pickOne(s,Object.entries(conditionTypes).filter(([k,t])=>t.serious&&age>=t.minAge));const c=contract(s,type,{silent:true});if(c)healthEvent(s,c)}
 if(st.happiness<15&&!conditionsOf(s).some(c=>c.type==='burnout')&&age>=18&&roll(s)<.05*weeks){const c=contract(s,'burnout',{silent:true});if(c)healthEvent(s,c)}
 // Pets age
 for(const p of pets){if(personAgeYears(date,p.born)>=p.lifespan&&roll(s)<.02*weeks){p.alive=false;p.diedOn=date;st.happiness=limit(st.happiness-15);queueEvent(s,'life',`${p.name} has died`,`Your ${p.species.toLowerCase()} ${p.name} passed away at ${personAgeYears(date,p.born)}. The house feels quieter.`,[choice('ack','Say goodbye')],{kind:'ack'})}}
 // Family members age and pass away
 familyTick(s,weeks);
 // Your own mortality
 const risk=annualMortality(age,s.health)*days/365;
 if(s.health<=0||roll(s)<risk){handleDeath(s,catalogue,causeOfDeath(s,age));return}
 // Fresh offers and invitations become popups instead of hiding on the main screen
 announceOffers(s);
 // Random life events
 if(!openLifeEvent(s)&&roll(s)<Math.min(.6,.15*weeks))randomEvent(s,catalogue);
 st.lastTick=date;
}
const personAgeYears=(date,born)=>Number(date.slice(0,4))-Number(born.slice(0,4))-(date.slice(5)<born.slice(5)?1:0);
function causeOfDeath(s,age){const serious=conditionsOf(s).find(c=>conditionTypes[c.type].serious);if(serious)return serious.name.toLowerCase();return age<50?pickOne(s,['a sudden illness','an accident']):age<80?pickOne(s,['a heart attack','a stroke','complications after surgery']):pickOne(s,['natural causes','old age','pneumonia'])}
function healthEvent(s,c){const t=conditionTypes[c.type];queueEvent(s,'health',t.serious?'Bad news from the doctor':'You are not well',`${t.serious?'Tests confirm':'You have come down with'} ${t.name.toLowerCase()}. ${t.weeks?`It could take ${t.weeks} weeks to pass on its own.`:'It will not clear up without treatment.'}`,[choice('treat',`See a doctor (${fmtCash(cash(s,t.cost))})`),choice('rest','Rest and hope for the best'),choice('ignore','Push through it')],{kind:'condition',conditionId:c.id})}

function familyTick(s,weeks){
 const date=dateOf(s);
 for(const p of s.people.filter(p=>p.alive&&p.id!==s.activeId&&(p.relative||bond(s,p).dating))){
  const age=personAge(s,p);if(age<1)continue;
  if(roll(s)<annualMortality(age,p.healthHint??80)*weeks*7/365){
   p.alive=false;p.diedOn=date;const r=bond(s,p),close=p.relative||r.dating,st=ensureLife(s);
   st.happiness=limit(st.happiness-(close?25:8));
   if(r.dating){r.dating=false;r.status='widowed'}
   let inheritance=0;
   if(['Parent','Grandparent'].includes(p.relative)){inheritance=cash(s,(p.occupation==='Actor'||p.occupation==='Director'||p.occupation==='Producer'?60000:15000)*(.3+roll(s)*1.5));s.money+=inheritance}
   queueEvent(s,'family',`${p.name} has died`,`Your ${relationLabel(s,p)} ${p.name} died at ${age}.${inheritance?` You inherit ${fmtCash(inheritance)}.`:''}`,[choice('funeral',`Hold a funeral (${fmtCash(cash(s,4000))})`),choice('quiet','Grieve privately')],{kind:'bereavement',personId:p.id});
  }
 }
}
function relationLabel(s,p){if(p.relative)return p.relative.toLowerCase()==='self'?'':p.relative.toLowerCase();const r=bond(s,p);return r.status==='married'?'spouse':'partner'}

// ---------------------------------------------------------- death & legacy
export function ribbonFor(summary){
 if(summary.awardsWon>=3)return {id:'acclaimed',name:'Acclaimed',why:'Won three or more major awards'};
 if(summary.peakFame>=85)return {id:'icon',name:'Screen icon',why:'Reached the very top of fame'};
 if(summary.netWorth>=20e6)return {id:'mogul',name:'Mogul',why:'Built a fortune worth over $20 million'};
 if(summary.credits>=30)return {id:'workhorse',name:'Workhorse',why:'Thirty or more screen credits'};
 if(summary.children>=3)return {id:'family',name:'Family first',why:'Raised a big family'};
 if(summary.marriages>=1&&summary.age>=70)return {id:'devoted',name:'Devoted',why:'A long life shared with someone'};
 if(summary.credits===0)return {id:'civilian',name:'Off screen',why:'Lived a life away from the cameras'};
 if(summary.age<35)return {id:'gone-too-soon',name:'Gone too soon',why:'A life cut short'};
 return {id:'working-actor',name:'Working actor',why:'A steady career in the business'};
}
export function lifeSummary(s,p=active(s)){
 const st=s.lifeStats?.[p.id]||{},credits=s.filmography.filter(f=>f.personId===p.id),awards=(s.awards||[]).filter(a=>a.personId===p.id);
 const owned=(s.possessions||[]).filter(x=>x.ownerId===p.id).reduce((n,x)=>n+(x.paid||0),0);
 const summary={personId:p.id,name:p.name,born:p.id===s.activeId?s.birthday:`${p.birthYear}`,died:dateOf(s),age:personAge(s,p),credits:credits.length,released:credits.filter(c=>c.status==='released').length,awardsWon:awards.filter(a=>a.status==='won'&&!a.productionAward).length,nominations:awards.filter(a=>!a.productionAward).length,peakFame:Math.round(Math.max(st.peakFame||0,p.id===s.activeId?s.fame:p.fame||0)),netWorth:Math.round((p.id===s.activeId?s.money:0)+owned),children:s.children.filter(id=>s.people.find(x=>x.id===id)?.parentId!==undefined?s.people.find(x=>x.id===id).parentId===p.id:true).length,marriages:Object.values(s.relationships||{}).filter(r=>['married','widowed'].includes(r.status)).length,bestKnown:credits.filter(c=>c.outcome).sort((a,b)=>(b.outcome.commercial||0)-(a.outcome.commercial||0))[0]?.title||credits[0]?.title||null};
 summary.ribbon=ribbonFor(summary);
 summary.score=Math.round(summary.released*6+summary.awardsWon*40+summary.nominations*8+summary.peakFame*1.5+Math.log10(1+Math.max(0,summary.netWorth))*6+summary.children*4);
 return summary;
}
export function handleDeath(s,catalogue,cause){
 ensureLife(s);const p=active(s),summary=lifeSummary(s,p);summary.cause=cause;
 s.legacies.unshift(summary);
 die(s,p,cause);// lifeVersion saves do not auto-switch; we offer heirs below
 const heirs=s.children.map(id=>s.people.find(x=>x.id===id)).filter(x=>x?.alive&&personAge(s,x)>=4).slice(0,3);
 s.complete=true;s.awaitingHeir=heirs.length>0;
 queueEvent(s,'legacy',`${p.name} has died`,`${p.name} died at ${summary.age} from ${cause}. Ribbon: ${summary.ribbon.name}. ${heirs.length?'Your story can continue through your family.':'There is no one old enough to continue this story.'}`,[...heirs.map(h=>choice(`heir:${h.id}`,`Continue as ${h.name} (${personAge(s,h)})`)),choice('end','Close this life')],{kind:'legacy'},`death-${p.id}`);
 return summary;
}
export function continueAs(s,heirId){
 const heir=s.people.find(p=>p.id===heirId),former=active(s);if(!heir?.alive)throw Error('That family member cannot continue the story.');
 const estate=Math.max(0,s.money),tax=Math.round(estate*.2);
 s.complete=false;s.awaitingHeir=false;
 for(const item of s.possessions||[])if(item.ownerId===former.id)item.ownerId=heir.id;
 for(const pet of s.pets)if(pet.ownerId===former.id)pet.ownerId=heir.id;
 if(s.lifeStats?.[former.id])s.lifeStats[former.id].health=s.health;
 switchTo(s,heir.id);
 s.money=estate-tax;s.health=s.lifeStats?.[heir.id]?.health??88;
 ensureLife(s);
 feed(s,'An inheritance',`${heir.name} inherits ${fmtCash(estate-tax)} after estate tax${(s.possessions||[]).some(x=>x.ownerId===heir.id)?', plus the family property':''}.`);
}

// -------------------------------------------------------------- activities
export const activities=[
 {id:'gym',group:'Mind & body',name:'Go to the gym',minAge:12,energy:15,cost:0,blurb:'Health and looks'},
 {id:'run',group:'Mind & body',name:'Go for a run',minAge:8,energy:15,cost:0,blurb:'Health'},
 {id:'meditate',group:'Mind & body',name:'Meditate',minAge:10,energy:10,cost:0,blurb:'Happiness'},
 {id:'read',group:'Mind & body',name:'Read a book',minAge:6,energy:10,cost:0,blurb:'Happiness, a little acting'},
 {id:'doctor',group:'Mind & body',name:'See a doctor',minAge:0,energy:0,cost:0,blurb:'Treat conditions or get a check-up'},
 {id:'therapy',group:'Mind & body',name:'Therapy session',minAge:13,energy:10,cost:150,blurb:'Happiness, can ease anxiety'},
 {id:'spa',group:'Mind & body',name:'Spa day',minAge:16,energy:5,cost:300,blurb:'Happiness and looks'},
 {id:'surgery',group:'Mind & body',name:'Cosmetic surgery',minAge:18,energy:30,cost:9000,blurb:'Looks, with real risk'},
 {id:'class',group:'Craft',name:'Acting class',minAge:5,energy:15,cost:120,blurb:'Acting'},
 {id:'improv',group:'Craft',name:'Improv night',minAge:14,energy:15,cost:20,blurb:'Comedy, happiness'},
 {id:'theatre',group:'Craft',name:'Community theatre',minAge:8,energy:20,cost:0,blurb:'Drama, a small chance of being noticed'},
 {id:'voice',group:'Craft',name:'Voice coaching',minAge:12,energy:15,cost:200,blurb:'Acting'},
 {id:'social',group:'Fame',name:'Post on social media',minAge:13,minYear:2006,energy:5,cost:0,blurb:'Fame, a gamble with your image'},
 {id:'charity',group:'Fame',name:'Volunteer for a charity',minAge:10,energy:20,cost:0,blurb:'Public image and happiness'},
 {id:'donate',group:'Fame',name:'Donate to charity',minAge:18,energy:0,cost:5000,blurb:'Public image'},
 {id:'club',group:'Going out',name:'Go clubbing',minAge:18,energy:20,cost:80,blurb:'Happiness, meet people'},
 {id:'concert',group:'Going out',name:'See a concert',minAge:10,energy:15,cost:90,blurb:'Happiness'},
 {id:'holiday',group:'Going out',name:'Take a holiday alone',minAge:18,energy:0,cost:2500,blurb:'Big happiness boost, takes a week'},
 {id:'lottery',group:'Going out',name:'Buy a lottery ticket',minAge:18,energy:0,cost:2,blurb:'Almost certainly nothing'},
 {id:'adopt',group:'Family',name:'Adopt a child',minAge:25,energy:0,cost:15000,blurb:'A new member of the family'},
];
export function activityReason(s,a){
 const age=ageOf(s);if(s.complete)return 'This life has ended.';
 if(s.prison&&s.prison.personId===s.activeId&&s.prison.until>dateOf(s))return 'Not possible from prison.';
 if(age<a.minAge)return `Available from age ${a.minAge}.`;
 if(a.minYear&&s.year<a.minYear)return `Not available until ${a.minYear}.`;
 if((s.energy??100)<a.energy)return `Needs ${a.energy} energy.`;
 if(a.cost&&s.money<cash(s,a.cost))return `Costs ${fmtCash(cash(s,a.cost))}.`;
 if(a.id==='holiday'){const r=calendarReason(s,dateOf(s),plusDays(dateOf(s),7));if(r)return r}
 return '';
}
export const activityCost=(s,a)=>a.cost?cash(s,a.cost):0;
export function doActivity(s,id){
 const a=activities.find(x=>x.id===id);if(!a)throw Error('Unknown activity.');
 const reason=activityReason(s,a);if(reason)throw Error(reason);
 const st=ensureLife(s),life=ensureOverhaul(s),price=activityCost(s,a),r=roll(s);
 s.energy=(s.energy??100)-a.energy;s.money-=price;
 const out=(title,body)=>{feed(s,title,body);return {title,body}};
 switch(id){
  case 'gym':nudge(s,{health:3,looks:1.5,happiness:2});return out('Gym session',r<.08?'You overdid it and pulled a muscle.':pickOne(s,['Leg day. You will regret it tomorrow.','You set a new personal best.','A solid workout.']));
  case 'run':nudge(s,{health:3,happiness:2});if(r<.05)contract(s,'sprain');return out('A run',r<.05?'You rolled your ankle on a kerb.':'Fresh air and a clear head.');
  case 'meditate':nudge(s,{happiness:4});return out('Meditation',pickOne(s,['You actually managed ten quiet minutes.','Your mind wandered to auditions the whole time.','You feel calmer.']));
  case 'read':nudge(s,{happiness:3});s.skills.drama=limit(s.skills.drama+(r<.4?1:0));return out('Reading',pickOne(s,['You lost a whole afternoon in a novel.','A biography of a great actor gives you ideas.','You read a play and imagine yourself in the lead.']));
  case 'doctor':{const list=conditionsOf(s);if(!list.length){const price2=cash(s,80);if(s.money<price2)throw Error(`A check-up costs ${fmtCash(price2)}.`);s.money-=price2;nudge(s,{health:2});return out('Check-up',s.health>=70?'The doctor says you are in good shape.':'The doctor tells you to look after yourself better.')}return treat(s,list[0].id)}
  case 'therapy':nudge(s,{happiness:7});{const anx=conditionsOf(s).find(c=>['anxiety','burnout'].includes(c.type));if(anx&&r<.35){recover(s,anx,'with support');return out('Therapy',`Talking it through helps. Your ${anx.name.toLowerCase()} has eased.`)}}return out('Therapy','You talk through what has been on your mind. It helps.');
  case 'spa':nudge(s,{happiness:6,looks:1});return out('Spa day','Massages, steam rooms and absolutely no scripts.');
  case 'surgery':if(r<.12){nudge(s,{looks:-12,happiness:-12,health:-8});return out('Surgery went wrong','The results are not what you hoped for. It will take time to recover.')}nudge(s,{looks:14,happiness:5,health:-3});return out('Cosmetic surgery','The results look great. Nobody can quite tell what changed.');
  case 'class':s.skills.acting=limit(s.skills.acting+2);return out('Acting class',pickOne(s,['The teacher singles out your scene work.','You struggle with the exercise, but learn from it.','A breakthrough with an emotional monologue.']));
  case 'improv':s.skills.comedy=limit(s.skills.comedy+2);nudge(s,{happiness:3});return out('Improv night',r<.3?'You absolutely bombed. The audience was kind about it.':'The room laughed. Really laughed.');
  case 'theatre':s.skills.drama=limit(s.skills.drama+2);if(r<.06){s.fame=limit(s.fame+2);careerProfile(s).reputation=limit(careerProfile(s).reputation+3);return out('Community theatre','A local critic singles you out. People in the business hear about it.')}return out('Community theatre','A small stage, a loyal audience and good practice.');
  case 'voice':s.skills.acting=limit(s.skills.acting+1);s.skills.drama=limit(s.skills.drama+1);return out('Voice coaching','Breathing, projection and accents. Hard work, but it shows.');
  case 'social':if(r<.12){life.publicImage=limit(life.publicImage-6);nudge(s,{happiness:-4});return out('A post backfires','People pile on a careless post. You delete it, but screenshots are forever.')}if(r>.93){s.fame=limit(s.fame+4);return out('Your post goes viral','Millions see it. Your follower count explodes.')}s.fame=limit(s.fame+(s.fame<30?.5:.2));return out('A new post','A few likes and comments. Building an audience takes time.');
  case 'charity':life.publicImage=limit(life.publicImage+2);nudge(s,{happiness:4});return out('Volunteering','You help out for the day and feel better for it.');
  case 'donate':life.publicImage=limit(life.publicImage+4);nudge(s,{happiness:3});return out('A donation',`You give ${fmtCash(price)} to a good cause.`);
  case 'club':nudge(s,{happiness:5,health:-1});if(r<.07){life.publicImage=limit(life.publicImage-(s.fame>30?4:0));return out('A wild night',s.fame>30?'A photographer catches you stumbling out at 3am.':'You do not remember getting home.')}return out('Clubbing',pickOne(s,['You dance until the lights come on.','The music was terrible but the company was great.','You lose your friends for an hour and find them at a kebab shop.']));
  case 'concert':nudge(s,{happiness:6});return out('A concert','You sing along until your voice goes.');
  case 'holiday':{reserve(s,{id:`trip-${s.nextId++}`,title:'Holiday',start:dateOf(s),end:plusDays(dateOf(s),7),kind:'holiday'});nudge(s,{happiness:15,health:4});const where=pickOne(s,['Lisbon','Bali','the Amalfi Coast','Tokyo','Iceland','Cape Town','Mexico City']);return {...out('A holiday',`A week in ${where}. You come home rested.`),advanceDays:7}}
  case 'lottery':if(r<.0004){const prize=cash(s,2500000);s.money+=prize;nudge(s,{happiness:30});return out('You won the lottery!',`The numbers match. You win ${fmtCash(prize)}.`)}if(r<.03){s.money+=cash(s,50);return out('A small win','You win $50 back. The house still wins.')}return out('Lottery ticket','Not a single number. Maybe next week.');
  case 'adopt':{const child=addChild(s,{adopted:true});return out('An adoption',`${child.name} joins your family.`)}
 }
}

// ------------------------------------------------------------ family & love
export function addChild(s,{otherParent=null,adopted=false,name=null}={}){
 const a=active(s),surname=a.name.split(' ').slice(1).join(' ')||a.name;
 const gender=pickOne(s,['female','male']);
 const first=name||pickOne(s,gender==='female'?['Ava','Mia','Lily','Isla','Rose','Zoe','Ruby','Hazel','Iris','Nora','Esme','June']:['Leo','Jack','Arlo','Felix','Oscar','Theo','Kai','Milo','Rory','Ezra','Jude','Otis']);
 let full=`${first} ${surname}`;while(s.usedPeople.includes(full))full=`${first} ${pickOne(s,['J.','M.','R.','A.'])} ${surname}`;
 const birthYear=adopted?s.year-Math.floor(roll(s)*5):s.year;
 const child=person(s,full,adopted&&s.year-birthYear>=4?'Student':'Child',birthYear,'Child',gender);
 child.birthDate=adopted?`${birthYear}-${dateOf(s).slice(5)}`:dateOf(s);child.parentId=a.id;child.otherParentId=otherParent?.id||null;child.adopted=adopted;
 s.children.push(child.id);const r=bond(s,child);r.friendship=80;r.met=dateOf(s);
 nudge(s,{happiness:12});return child;
}
export const familyActions={
 gift:{label:'Give a gift',cost:120,energy:0},
 compliment:{label:'Compliment them',cost:0,energy:0},
 time:{label:'Spend time together',cost:0,energy:15},
 money:{label:'Ask for money',cost:0,energy:0},
 argue:{label:'Start an argument',cost:0,energy:0},
 baby:{label:'Try for a baby',cost:0,energy:20},
 divorce:{label:'File for divorce',cost:0,energy:0},
};
export function familyActionReason(s,p,kind){
 const r=bond(s,p),age=ageOf(s),a=familyActions[kind];if(!a||!p.alive||s.complete)return 'Unavailable.';
 if(a.energy&&(s.energy??100)<a.energy)return `Needs ${a.energy} energy.`;
 if(a.cost&&s.money<cash(s,a.cost))return `Costs ${fmtCash(cash(s,a.cost))}.`;
 if(['time','baby'].includes(kind)&&s.prison&&s.prison.personId===s.activeId&&s.prison.until>dateOf(s))return 'Not possible from prison.';
 if(kind==='money'&&!['Parent','Grandparent','Sibling'].includes(p.relative))return 'Only family will lend you money.';
 if(kind==='money'&&r.askedOn&&daysBetween(r.askedOn,dateOf(s))<90)return 'You asked recently.';
 if(kind==='baby'){if(!romanceAllowed(s,p,{adult:true})||!r.dating)return 'Only with an adult partner.';if(!['cohabiting','engaged','married'].includes(r.status))return 'Live together first.';if(age>50&&personAge(s,p)>50)return 'Consider adoption instead.';if(s.pregnancy&&s.pregnancy.personId===s.activeId)return 'A baby is already on the way.'}
 if(kind==='divorce'&&r.status!=='married')return 'You are not married to them.';
 return '';
}
export function familyAction(s,p,kind){
 const reason=familyActionReason(s,p,kind);if(reason)throw Error(reason);
 const r=bond(s,p),a=familyActions[kind],x=roll(s),out=(title,body)=>{r.memories.unshift({date:dateOf(s),title,body});r.memories.length=Math.min(r.memories.length,32);feed(s,`${title} · ${p.name}`,body);return {title,body}};
 if(a.energy)s.energy-=a.energy;if(a.cost)s.money-=cash(s,a.cost);
 switch(kind){
  case 'gift':r.friendship=limit(r.friendship+6,-100,100);if(r.dating)r.affection=limit((r.affection||0)+6);nudge(s,{happiness:2});return out('A gift',x<.15?'They smile politely. It was clearly not their thing.':pickOne(s,['They love it.','They are genuinely touched.','It is exactly what they wanted.']));
  case 'compliment':r.friendship=limit(r.friendship+(r.complimentOn===dateOf(s)?0:3),-100,100);r.complimentOn=dateOf(s);return out('A compliment',x<.1?'They roll their eyes, but they are smiling.':'It lands. They look pleased.');
  case 'time':r.friendship=limit(r.friendship+7,-100,100);r.tension=limit((r.tension||0)-8);r.lastQuality=dateOf(s);nudge(s,{happiness:4});return out('Time together',pickOne(s,['You cook dinner and talk for hours.','A long walk and an even longer chat.','You watch an old film together and quote every line.']));
  case 'money':{r.askedOn=dateOf(s);const chance=limit((r.friendship+40)/150,.15,.85);if(x<chance){const gift=cash(s,(ageOf(s)<18?40:800)*(1+roll(s)*3));s.money+=gift;return out('A loan from family',`They give you ${fmtCash(gift)}.`)}r.friendship=limit(r.friendship-4,-100,100);return out('Turned down','They say no, and look a little hurt you asked.')}
  case 'argue':r.friendship=limit(r.friendship-10,-100,100);r.tension=limit((r.tension||0)+12);nudge(s,{happiness:-3});return out('An argument',pickOne(s,['It escalates fast. Doors are slammed.','You both say things you do not mean.','It ends in silence.']));
  case 'baby':{r.lastQuality=dateOf(s);const fertility=limit(.35-Math.max(0,ageOf(s)-35)*.025,.05,.35);if(x<fertility){s.pregnancy={personId:s.activeId,partnerId:p.id,due:plusDays(dateOf(s),270)};return out('A baby is on the way','You are expecting. The due date is in about nine months.')}return out('Trying for a baby','Not yet. You decide to keep trying.')}
  case 'divorce':{const settlement=Math.round(Math.max(0,s.money)*.4);s.money-=settlement;r.dating=false;r.status='divorced';r.cohabiting=false;r.commitment=0;r.tension=limit((r.tension||0)+30);if(p.socialLife)p.socialLife={status:'single',partnerName:null,lastChange:dateOf(s)};nudge(s,{happiness:-15});return out('A divorce',`The marriage is over. The settlement and legal fees cost you ${fmtCash(settlement)}.`)}
 }
}
function pregnancyTick(s){const pr=s.pregnancy;if(!pr||pr.personId!==s.activeId||dateOf(s)<pr.due)return;s.pregnancy=null;const partner=s.people.find(p=>p.id===pr.partnerId),child=addChild(s,{otherParent:partner});queueEvent(s,'family','A baby is born',`${child.name} is born${partner?`, a child with ${partner.name}`:''}. You are a parent.`,[choice('ack','Hold them')],{kind:'ack'})}

// --------------------------------------------------------------- shop & pets
export const assetKind=id=>assets.find(a=>a.id===id)?.kind||'luxury';
export const petTypes=[{id:'dog',species:'Dog',price:900,monthly:90,lifespan:13,minAge:6},{id:'cat',species:'Cat',price:400,monthly:60,lifespan:16,minAge:6},{id:'rabbit',species:'Rabbit',price:120,monthly:30,lifespan:9,minAge:5},{id:'parrot',species:'Parrot',price:1500,monthly:40,lifespan:40,minAge:10},{id:'horse',species:'Horse',price:12000,monthly:900,lifespan:28,minAge:12}];
const petNames=['Biscuit','Luna','Pepper','Milo','Bella','Charlie','Olive','Teddy','Maple','Ziggy','Nala','Rocky','Pickles','Juno'];
export function adoptPet(s,type){const t=petTypes.find(p=>p.id===type);if(!t)throw Error('Unknown pet.');if(ageOf(s)<t.minAge)throw Error(`Available from age ${t.minAge}.`);const price=cash(s,t.price);if(s.money<price)throw Error(`Costs ${fmtCash(price)}.`);s.money-=price;ensureLife(s);const pet={id:`pet-${s.nextId++}`,ownerId:s.activeId,type,species:t.species,name:pickOne(s,petNames),born:plusDays(dateOf(s),-365*(type==='horse'?4:1)),lifespan:t.lifespan+Math.round(roll(s)*4-2),alive:true,monthly:t.monthly};s.pets.push(pet);nudge(s,{happiness:10});feed(s,'A new pet',`You bring home ${pet.name} the ${t.species.toLowerCase()}.`);return pet}
export const petCosts=s=>(s.pets||[]).filter(p=>p.ownerId===s.activeId&&p.alive).reduce((n,p)=>n+p.monthly,0)*eraValue(s.year);

// ----------------------------------------------------------- offer popups
function announceOffers(s){
 for(const o of (s.roleOffers||[]).filter(o=>o.personId===s.activeId&&o.status==='offered'&&!o.announced)){
  o.announced=true;
  const label={'tv-return':'Your show wants you back',spinoff:'A spin-off with your name on it',revival:'They are bringing it back','legacy-sequel':'A legacy sequel',contract:'Your franchise return',agent:'Your agent found you a role',studio:'A studio wants you'}[o.source]||'You got the part';
  queueEvent(s,'offer',label,`${o.title}: they want you as ${o.character} for ${fmtCash(o.fee)}${o.agentCommission?` (${Math.round(o.agentCommission*100)}% to your agent)`:''}. Decide by ${o.expiresOn}.`,[choice('accept','Accept the role'),choice('later','Let me think about it'),choice('decline','Turn it down')],{offerId:o.id},`offer-${o.id}`);
 }
}

// -------------------------------------------------------------- random events
const ev=(id,spec)=>({id,...spec});
const eventPool=[
 ev('school-play',{min:5,max:12,title:'The school play',body:'Your teacher wants you to audition for the lead in the school play.',options:[['audition','Go for the lead'],['chorus','Join the chorus'],['skip','Skip it']]}),
 ev('bully',{min:6,max:15,title:'Trouble at school',body:'An older kid keeps picking on you.',options:[['teacher','Tell a teacher'],['stand','Stand up to them'],['ignore','Ignore it']]}),
 ev('stray',{min:6,max:70,noPet:true,title:'A stray animal',body:'A scruffy stray cat follows you home and will not leave.',options:[['keep','Keep it'],['shelter','Take it to a shelter']]}),
 ev('talent-show',{min:8,max:17,title:'Talent show',body:'There is a local talent show this weekend.',options:[['perform','Perform a monologue'],['comedy','Try stand-up'],['watch','Just watch']]}),
 ev('exam',{min:11,max:18,title:'Exams',body:'Exams are coming up and rehearsals are eating your time.',options:[['study','Study hard'],['cram','Cram the night before'],['skip','Wing it']]}),
 ev('party',{min:15,max:19,title:'A house party',body:'Everyone is going to a party at a classmate’s house.',options:[['go','Go'],['stay','Stay home and rehearse']]}),
 ev('job',{min:16,max:24,title:'A part-time job',body:'A café nearby offers you weekend shifts.',options:[['take','Take the job'],['decline','Focus on acting']]}),
 ev('driving',{min:17,max:30,once:true,title:'Driving test',body:'Your driving test is today.',options:[['take','Take the test'],['postpone','Postpone it']]}),
 ev('wallet',{min:10,max:90,title:'A lost wallet',body:'You find a wallet on the pavement with cash inside.',options:[['return','Hand it in'],['keep','Keep the cash']]}),
 ev('fan',{min:12,max:99,fame:20,title:'A fan spots you',body:'Someone stops you in the street, shaking with excitement.',options:[['selfie','Take a selfie'],['autograph','Sign an autograph'],['refuse','Politely say no']]}),
 ev('paparazzi',{min:16,max:99,fame:40,title:'Paparazzi',body:'Photographers are waiting outside your home.',options:[['smile','Smile and wave'],['confront','Confront them'],['hide','Leave through the back']]}),
 ev('tabloid',{min:18,max:99,fame:35,title:'A tabloid story',body:'A tabloid runs a made-up story about you.',options:[['sue','Sue for libel'],['statement','Issue a statement'],['ignore','Ignore it']]}),
 ev('viral',{min:13,max:99,year:2007,title:'You are trending',body:'A clip of you from an old interview is going viral.',options:[['lean','Lean into it'],['ignore','Stay quiet']]}),
 ev('endorsement',{min:18,max:99,fame:30,title:'A brand deal',body:'A sportswear brand wants you as the face of a campaign.',options:[['accept','Sign the deal'],['negotiate','Hold out for more'],['decline','Turn it down']]}),
 ev('car-breakdown',{min:17,max:99,asset:'car',title:'Car trouble',body:'Your car breaks down on the motorway.',options:[['repair','Pay for repairs'],['ignore','Leave it for now']]}),
 ev('burglary',{min:18,max:99,asset:'home',title:'A break-in',body:'You come home to find your door forced open.',options:[['police','Call the police'],['upgrade','Install a security system']]}),
 ev('investment',{min:21,max:85,money:20000,title:'An investment tip',body:'A producer friend tips you off about a start-up looking for investors.',options:[['invest','Invest 10% of your savings'],['decline','Keep your money']]}),
 ev('gala',{min:21,max:99,fame:45,title:'A charity gala',body:'You are invited to a charity gala. Guests are expected to donate.',options:[['attend','Attend and donate'],['decline','Send your regrets']]}),
 ev('food-poisoning',{min:4,max:99,title:'Something you ate',body:'Last night’s takeaway was a mistake.',options:[['rest','Stay in bed'],['work','Push on']]}),
 ev('sibling-loan',{min:20,max:80,relative:'Sibling',money:2000,title:'A family favour',body:'Your sibling asks to borrow money.',options:[['lend','Lend it'],['refuse','Say no']]}),
 ev('reunion',{min:25,max:90,title:'An old friend',body:'An old school friend messages you out of the blue.',options:[['meet','Meet for a drink'],['ignore','Leave them on read']]}),
 ev('jury',{min:18,max:75,title:'Jury duty',body:'You have been summoned for jury duty.',options:[['serve','Serve'],['excuse','Ask to be excused for work']]}),
 ev('audit',{min:21,max:99,money:250000,title:'A tax audit',body:'The tax office has questions about your last few years.',options:[['accountant','Hire a good accountant'],['yourself','Handle it yourself']]}),
 ev('presenter',{min:18,max:99,fame:60,title:'Present an award',body:'You are asked to present an award at a big ceremony.',options:[['accept','Accept'],['decline','Decline']]}),
 ev('director-dinner',{min:18,max:99,fame:15,title:'Dinner with a director',body:'A well-known director wants to have dinner and talk about the future.',options:[['go','Go'],['decline','Too busy']]}),
 ev('midlife',{min:40,max:55,title:'A midlife moment',body:'You wake up feeling like life is slipping away.',options:[['car','Buy something fast'],['therapy','Talk to someone'],['tattoo','Get a tattoo']]}),
 ev('checkup',{min:50,max:99,title:'Time for a check-up',body:'Your doctor recommends a full health screening.',options:[['go',`Book it`],['skip','Skip it']]}),
 ev('stage',{min:16,max:90,title:'A stage role',body:'A theatre offers you a short run in a new play. The pay is modest.',options:[['accept','Take the stage'],['decline','Stay focused on screen work']]}),
 ev('stunt',{min:16,max:70,filming:true,title:'A dangerous stunt',body:'The director wants you to do your own stunt today.',options:[['do','Do it yourself'],['double','Use the stunt double']]}),
 ev('diet',{min:16,max:70,filming:true,title:'Transforming for a role',body:'The production asks you to change your body for the part.',options:[['commit','Commit fully'],['healthy','Do it safely and slowly']]}),
 ev('neighbour',{min:18,max:99,asset:'home',title:'A noisy neighbour',body:'Your neighbour has been playing music at 3am all week.',options:[['talk','Knock and talk'],['complain','Complain to the council'],['earplugs','Buy earplugs']]}),
 ev('pet-sick',{min:6,max:99,pet:true,title:'Your pet is unwell',body:'Your pet has stopped eating.',options:[['vet','Take them to the vet'],['wait','Wait and see']]}),
 ev('proposal',{min:18,max:99,partner:'dating',title:'A question',body:'Your partner gets down on one knee.',options:[['yes','Say yes'],['no','Say no']]}),
 ev('partner-baby',{min:24,max:48,partner:'living',title:'A big conversation',body:'Your partner says they want to start a family.',options:[['yes','Let’s try'],['wait','Not yet'],['no','I don’t want children']]}),
 ev('anniversary',{min:18,max:99,partner:'married',title:'Your anniversary',body:'It is your wedding anniversary.',options:[['dinner','Plan a special dinner'],['gift','Buy a gift'],['forget','Completely forget']]}),
];
function eventEligible(s,e,ctx){
 const age=ageOf(s);if(age<e.min||age>e.max)return false;if(e.fame&&s.fame<e.fame)return false;if(e.year&&s.year<e.year)return false;if(e.money&&s.money<cash(s,e.money))return false;
 if(e.once&&(s.lifeOnce||[]).includes(`${s.activeId}:${e.id}`))return false;
 if(e.asset&&!(s.possessions||[]).some(p=>p.ownerId===s.activeId&&assetKind(p.id)===e.asset))return false;
 if(e.pet&&!s.pets.some(p=>p.ownerId===s.activeId&&p.alive))return false;
 if(e.noPet&&s.pets.some(p=>p.ownerId===s.activeId&&p.alive))return false;
 if(e.filming&&!ctx.filming)return false;
 if(e.relative&&!s.people.some(p=>p.alive&&p.relative===e.relative))return false;
 if(e.partner){const partner=partnerOf(s);if(!partner)return false;const r=bond(s,partner);if(!romanceAllowed(s,partner,{adult:true}))return false;if(e.partner==='dating'&&!['committed','cohabiting'].includes(r.status))return false;if(e.partner==='living'&&!['cohabiting','engaged','married'].includes(r.status))return false;if(e.partner==='married'&&r.status!=='married')return false}
 return true;
}
export function partnerOf(s){const entry=Object.entries(s.relationships||{}).find(([,r])=>r.dating&&!r.affair);return entry&&s.people.find(p=>p.name===entry[0]&&p.alive)}
function randomEvent(s,catalogue){
 const filming=(s.filmography||[]).some(f=>f.personId===s.activeId&&f.status==='filming');
 const pool=eventPool.filter(e=>eventEligible(s,e,{filming}));if(!pool.length)return;
 s.lifeEventLog??={};const seen=s.lifeEventLog,recent=new Set(Object.entries(seen).filter(([,d])=>daysBetween(d,dateOf(s))<365).map(([k])=>k));
 const fresh=pool.filter(e=>!recent.has(e.id));if(!fresh.length)return;const e=pickOne(s,fresh);seen[e.id]=dateOf(s);
 const partner=e.partner?partnerOf(s):null,sibling=e.relative?s.people.find(p=>p.alive&&p.relative===e.relative):null;
 const body=e.body.replace('Your partner',partner?partner.name:'Your partner').replace('Your sibling',sibling?`Your sibling ${sibling.name}`:'Your sibling');
 if(e.once){s.lifeOnce??=[];s.lifeOnce.push(`${s.activeId}:${e.id}`)}
 queueEvent(s,'life',e.title,body,e.options.map(([id,label])=>choice(id,label)),{kind:e.id,personId:(partner||sibling)?.id});
}
export function resolveLifeChoice(s,catalogue,e,answer){
 const st=ensureLife(s),life=ensureOverhaul(s),x=roll(s),p=e.data.personId&&s.people.find(p=>p.id===e.data.personId);
 const fame=n=>{s.fame=limit(s.fame+n)},image=n=>{life.publicImage=limit(life.publicImage+n)},happy=n=>nudge(s,{happiness:n}),health=n=>nudge(s,{health:n}),pay=n=>{s.money-=Math.min(Math.max(0,s.money),n);return n},earn=n=>{s.money+=n;return n};
 const k=e.data.kind;
 if(e.type==='health'){
  const c=s.conditions.find(c=>c.id===e.data.conditionId&&c.status==='active');if(!c)return 'It has already passed.';
  if(answer==='treat'){try{return treat(s,c.id).body}catch(err){return `${err.message} You will have to rest instead.`}}
  if(answer==='rest'){s.energy=Math.max(0,(s.energy??100)-30);health(3);if(conditionTypes[c.type].weeks&&x<.35){recover(s,c,'with rest');return 'A few days in bed did the trick.'}return 'You rest up. You feel a little better.'}
  health(-4);happy(-2);return 'You push through it. Your body is not thrilled.';
 }
 if(e.type==='family'&&k==='bereavement'){if(answer==='funeral'){pay(cash(s,4000));happy(5);return 'Friends and family gather to say goodbye.'}return 'You grieve in your own way.'}
 if(k==='ack')return '';
 switch(k){
  case 'school-play':if(answer==='audition'){if(x<.35+s.skills.acting/200){s.skills.acting=limit(s.skills.acting+3);happy(8);return 'You got the lead! Parents give you a standing ovation.'}happy(-3);return 'You did not get the lead, but you got a speaking part.'}if(answer==='chorus'){s.skills.acting=limit(s.skills.acting+1);happy(3);return 'You sing loudly and mostly in tune.'}return 'You skip the play.';
  case 'bully':if(answer==='teacher'){happy(2);return x<.7?'The teacher sorts it out.':'Nothing really changes.'}if(answer==='stand'){if(x<.55){happy(6);return 'They back off and never bother you again.'}health(-4);happy(-4);return 'It turns into a scuffle. You come home with a black eye.'}happy(-3);return 'It keeps happening for a while.';
  case 'stray':if(answer==='keep'){const pet={id:`pet-${s.nextId++}`,ownerId:s.activeId,type:'cat',species:'Cat',name:pickOne(s,petNames),born:plusDays(dateOf(s),-365*2),lifespan:15,alive:true,monthly:60};s.pets.push(pet);happy(8);return `You name the cat ${pet.name}.`}return 'The shelter finds it a good home.';
  case 'talent-show':if(answer==='watch')return 'You enjoy the show from the audience.';{const skill=answer==='comedy'?s.skills.comedy:s.skills.drama;if(x<.25+skill/150){fame(1);happy(8);if(answer==='comedy')s.skills.comedy=limit(s.skills.comedy+2);else s.skills.drama=limit(s.skills.drama+2);return 'You win! Someone films it.'}happy(-2);return 'You come third. Not bad.'}
  case 'exam':if(answer==='study'){happy(-2);return x<.8?'You pass with good grades.':'You pass, just.'}if(answer==='cram'){return x<.5?'You scrape through.':'You fail a subject and have to retake it.'}happy(2);return x<.3?'Somehow you pass.':'It does not go well.';
  case 'party':if(answer==='go'){happy(6);if(x<.15){health(-3);return 'You stay out too late and get grounded.'}return 'It is the party everyone talks about for weeks.'}s.skills.acting=limit(s.skills.acting+1);return 'You stay home and run lines.';
  case 'job':if(answer==='take'){earn(cash(s,3000));s.energy=Math.max(0,(s.energy??100)-20);return `You earn ${fmtCash(cash(s,3000))} over the next few months.`}return 'You keep your weekends for auditions.';
  case 'driving':if(answer==='take'){if(x<.65){happy(6);return 'You pass first time.'}happy(-4);(s.lifeOnce||[]).splice((s.lifeOnce||[]).indexOf(`${s.activeId}:driving`),1);return 'You fail. You can try again later.'}(s.lifeOnce||[]).splice((s.lifeOnce||[]).indexOf(`${s.activeId}:driving`),1);return 'Maybe next year.';
  case 'wallet':if(answer==='return'){image(1);happy(3);if(x<.3){earn(cash(s,100));return 'The owner insists on giving you a reward.'}return 'The owner is incredibly grateful.'}earn(cash(s,120));happy(-1);if(s.fame>25&&x<.2){image(-6);return 'Someone recognised you on CCTV. The story makes the news.'}return `You pocket ${fmtCash(cash(s,120))}.`;
  case 'fan':if(answer==='refuse'){image(-1);return 'They walk off disappointed.'}image(1);happy(2);return answer==='selfie'?'They post it straight away. It gets a lot of likes.':'They promise to frame it.';
  case 'paparazzi':if(answer==='smile'){fame(.5);return 'The photos are flattering.'}if(answer==='confront'){if(x<.4){image(-6);return 'The video of you shouting at photographers goes everywhere.'}image(-1);return 'They back off a little.'}happy(-1);return 'You sneak out unseen.';
  case 'tabloid':if(answer==='sue'){const fee=pay(cash(s,25000));if(x<.55){earn(cash(s,90000));image(3);return `You win the case. After ${fmtCash(fee)} in fees, you are awarded damages.`}image(-1);return `You lose the case and ${fmtCash(fee)} in legal fees.`}if(answer==='statement'){image(x<.6?2:-2);return x<.6?'Your statement shuts the story down.':'The statement keeps the story alive another week.'}image(-1);return 'The story fades eventually.';
  case 'viral':if(answer==='lean'){fame(x<.7?3:1);image(x<.8?2:-3);return x<.8?'You join in on the joke. People love it.':'Your attempt to join in feels forced.'}return 'The moment passes.';
  case 'endorsement':{const base=cash(s,20000+s.fame*s.fame*40);if(answer==='accept'){earn(base);image(-1);return `You sign for ${fmtCash(base)}.`}if(answer==='negotiate'){if(x<.55){earn(Math.round(base*1.6));return `They come back with ${fmtCash(base*1.6)}. Deal.`}return 'They walk away and sign someone else.'}image(1);return 'You keep your image uncommercial.'}
  case 'car-breakdown':if(answer==='repair'){pay(cash(s,900));return `The repairs cost ${fmtCash(cash(s,900))}.`}happy(-3);return 'You take the bus for a while.';
  case 'burglary':if(answer==='upgrade'){pay(cash(s,3000));return 'You install cameras and better locks.'}const lost=Math.min(Math.max(0,s.money),cash(s,2000));pay(lost);happy(-6);return x<.3?'The police catch the burglar and recover your things.':`They took ${fmtCash(lost)} worth of valuables.`;
  case 'investment':if(answer==='invest'){const stake=Math.round(Math.max(0,s.money)*.1);pay(stake);if(x<.12){earn(stake*12);happy(15);return `The company is bought out. Your ${fmtCash(stake)} becomes ${fmtCash(stake*12)}.`}if(x<.45){earn(stake*2);return `A solid return: ${fmtCash(stake*2)}.`}return `The start-up folds. You lose ${fmtCash(stake)}.`}return 'You keep your money where it is.';
  case 'gala':if(answer==='attend'){pay(cash(s,10000));image(4);fame(.5);return 'You donate and network all night.'}return 'You stay home.';
  case 'food-poisoning':if(answer==='rest'){health(-1);return 'A rough couple of days.'}health(-4);return 'You throw up between takes. Not your finest hour.';
  case 'sibling-loan':if(answer==='lend'){pay(cash(s,2000));if(p)bond(s,p).friendship=limit(bond(s,p).friendship+10,-100,100);return x<.5?'They pay you back a few months later.':'You never see that money again.'}if(p)bond(s,p).friendship=limit(bond(s,p).friendship-8,-100,100);return 'They are upset, but they understand.';
  case 'reunion':if(answer==='meet'){happy(6);return 'You laugh about old times for hours.'}return 'You never reply.';
  case 'jury':if(answer==='serve'){s.energy=Math.max(0,(s.energy??100)-30);happy(1);return 'A week of jury duty. Oddly fascinating.'}return x<.6?'You are excused.':'The judge refuses. You serve anyway.';
  case 'audit':if(answer==='accountant'){pay(cash(s,15000));return 'Your accountant sorts it out. Everything is fine.'}if(x<.5){const fine=pay(Math.round(Math.max(0,s.money)*.08));happy(-6);return `You missed something. The fine is ${fmtCash(fine)}.`}return 'You get through it on your own.';
  case 'presenter':if(answer==='accept'){fame(1);image(2);return x<.15?'You mispronounce the winner’s name. It becomes a meme.':'You nail the presentation.'}return 'Someone else presents.';
  case 'director-dinner':if(answer==='go'){careerProfile(s).reputation=limit(careerProfile(s).reputation+4);happy(3);return 'You get on brilliantly. They promise to keep you in mind.'}return 'Maybe next time.';
  case 'midlife':if(answer==='car'){pay(cash(s,60000));happy(8);return 'You buy something red and fast. It helps for a while.'}if(answer==='therapy'){pay(cash(s,300));happy(10);return 'It helps to talk.'}happy(4);looksTweak(s,x<.5?1:-1);return 'A tattoo you will either love or regret.';
  case 'checkup':if(answer==='go'){pay(cash(s,400));const hidden=s.conditions.find(c=>c.personId===s.activeId&&c.status==='active'&&conditionTypes[c.type].serious);if(hidden)return `The screening confirms ${hidden.name.toLowerCase()}. Early treatment improves your chances.`;if(x<.08){contract(s,'bloodpressure');return 'They find high blood pressure. Good thing you went.'}health(2);return 'All clear.'}return 'You skip it.';
  case 'stage':if(answer==='accept'){s.skills.drama=limit(s.skills.drama+4);earn(cash(s,6000));careerProfile(s).reputation=limit(careerProfile(s).reputation+2);return x<.2?'The critics love it. The run is extended.':'A good run with a loyal audience.'}return 'You stay focused on screen work.';
  case 'stunt':if(answer==='do'){if(x<.12){contract(s,'fracture');return 'The stunt goes wrong. You break your arm.'}careerProfile(s).reputation=limit(careerProfile(s).reputation+3);return 'The crew applauds. It looks incredible on camera.'}return 'The stunt double handles it perfectly.';
  case 'diet':if(answer==='commit'){health(-8);s.skills.drama=limit(s.skills.drama+3);return 'The transformation is shocking. So is how you feel.'}health(1);return 'You change gradually and stay healthy.';
  case 'neighbour':if(answer==='talk')return x<.6?'They apologise and turn it down.':'They tell you to mind your own business.';if(answer==='complain')return 'The council sends a letter. It goes quiet.';pay(cash(s,15));return 'Earplugs. Peace at last.';
  case 'pet-sick':{const pet=s.pets.find(p=>p.ownerId===s.activeId&&p.alive);if(answer==='vet'){pay(cash(s,700));return `${pet?.name||'Your pet'} makes a full recovery.`}if(x<.25&&pet){pet.alive=false;pet.diedOn=dateOf(s);happy(-15);return `${pet.name} did not make it.`}return 'They start eating again.'}
  case 'proposal':if(!p)return '';{const r=bond(s,p);if(answer==='yes'){r.status='engaged';if(p.socialLife)p.socialLife.status='engaged';happy(12);return 'You say yes. You are engaged!'}r.tension=limit((r.tension||0)+25);happy(-4);return 'They are heartbroken.'}
  case 'partner-baby':if(!p)return '';{const r=bond(s,p);if(answer==='yes'){if(roll(s)<.4){s.pregnancy={personId:s.activeId,partnerId:p.id,due:plusDays(dateOf(s),270)};return 'Not long after, you find out a baby is on the way.'}return 'You start trying.'}r.tension=limit((r.tension||0)+(answer==='no'?20:6));return answer==='no'?'It causes real tension between you.':'They agree to wait, for now.'}
  case 'anniversary':if(!p)return '';{const r=bond(s,p);if(answer==='forget'){r.tension=limit((r.tension||0)+15);return 'They notice. They definitely notice.'}pay(cash(s,answer==='dinner'?250:150));r.affection=limit((r.affection||0)+6);r.lastQuality=dateOf(s);happy(4);return 'A lovely evening together.'}
 }
 return '';
}
function looksTweak(s,n){nudge(s,{looks:n})}

// --------------------------------------------------------------- one tick
export function weeklyLife(s,catalogue,days){ensureLife(s);pregnancyTick(s);lifeTick(s,catalogue,{days})}
