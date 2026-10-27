// v1.8 vice: affairs, homewrecking, crime, courts and prison. All fictional gameplay.
// Romance between the player and someone else stays adult-only (both 18+).
import {active,currentDate,available} from './engine.js?v=17';
import {bond,personAge,romanceAllowed,recordBreakup} from './relationships.js?v=17';
import {limit,feed,queueEvent,openLifeEvent,dateOf,plusDays,daysBetween,random,eraValue,ensureOverhaul,assets} from './game-rules.js?v=17';
import {careerProfile,pendingOffers,makeOffer,terminateContract} from './career.js?v=17';
import {nudge,ageOf} from './life.js?v=17';

const roll=s=>random(s);
const pickOne=(s,list)=>list[Math.floor(roll(s)*list.length)];
const cash=(s,n)=>Math.round(n*eraValue(s.year));
const fmt=n=>'$'+Math.round(n).toLocaleString('en-US');
const choice=(id,label)=>({id,label});
const between=(s,[a,b])=>a+(b-a)*roll(s);
const EXCLUSIVE=['committed','cohabiting','engaged','married'];
const remember=(s,p,title,body,log=true)=>{const r=bond(s,p);r.memories.unshift({date:dateOf(s),title,body});r.memories.length=Math.min(r.memories.length,32);if(log)feed(s,`${title} · ${p.name}`,body)};

// ------------------------------------------------------------------ helpers
export const inPrison=s=>Boolean(s.prison&&s.prison.personId===s.activeId&&s.prison.until>dateOf(s));
export function criminalRecord(s){s.records??={};return s.records[s.activeId]??=[]}
export const recordPenalty=s=>Math.min(25,(s.records?.[s.activeId]||[]).filter(r=>r.convicted).length*6);
export const isTaken=(s,p)=>Boolean(p?.socialLife&&p.socialLife.status!=='single'&&p.socialLife.partnerId!==s.activeId);
export function exclusivePartners(s,except=null){return s.people.filter(p=>p.alive&&p.id!==s.activeId&&p.name!==except?.name&&s.relationships?.[p.name]?.dating&&!s.relationships[p.name].affair&&EXCLUSIVE.includes(s.relationships[p.name].status))}
export const cheatingWith=(s,p)=>exclusivePartners(s,p).length>0||isTaken(s,p);

export function endRelationship(s,p,{byThem=false,why='',reason=''}={}){
 const r=bond(s,p),married=r.status==='married';let settlement=0;recordBreakup(s,r,byThem?'them':'you',reason||(byThem?'they ended it':'your decision'));
 if(married){settlement=Math.round(Math.max(0,s.money)*(byThem?.4:.3));s.money-=settlement}
 r.dating=false;r.affair=false;r.status=married?'divorced':'ex';r.cohabiting=false;r.commitment=0;r.tension=limit((r.tension||0)+30);r.trust=limit((r.trust||40)-30);r.suspicion=0;r.spaceUntil=plusDays(dateOf(s),60);
 if(p.socialLife?.partnerId===s.activeId)p.socialLife={status:'single',partnerName:null,lastChange:dateOf(s)};
 nudge(s,{happiness:married?-15:-8});
 remember(s,p,married?'A divorce':'It is over',`${why}${married?` The divorce costs you ${fmt(settlement)}.`:''}`.trim());
 return settlement;
}
function makeOpen(s,p){const r=bond(s,p);if(!r.dating)r.timesTogether=(r.timesTogether||0)+1;r.dating=true;r.affair=exclusivePartners(s,p).length>0;r.status=r.affair?'affair':'dating';r.datingSince??=dateOf(s);p.socialLife={status:'dating',partnerId:s.activeId,partnerName:active(s).name,lastChange:dateOf(s)};if(!r.affair)r.exposure=0}
function tabloid(s,p,line){const life=ensureOverhaul(s);if(s.fame<35&&(p?.fame||0)<45)return '';life.publicImage=limit(life.publicImage-6);s.fame=limit(s.fame+.5);return ` ${line||'The tabloids get hold of the story.'}`}

// ---------------------------------------------------------- cheating & homewrecking
// Called after a successful romantic interaction with p.
export function noteCheating(s,p,kind){
 const weight={flirt:6,date:18,hookup:25,outing:8,steal:20}[kind]||0;if(!weight)return;
 for(const partner of exclusivePartners(s,p)){const rr=bond(s,partner);rr.suspicion=limit((rr.suspicion||0)+weight);rr.cheatedWith=p.name}
 if(isTaken(s,p)){const r=bond(s,p);r.exposure=limit((r.exposure||0)+weight)}
}
export function viceReason(s,p,kind){
 const r=bond(s,p);
 if(!romanceAllowed(s,p,{adult:true}))return 'Only between two adults.';
 if(inPrison(s))return 'Not from a prison cell.';
 if(!isTaken(s,p))return 'They are single. Just ask them out.';
 if(kind==='steal'&&r.chemistry<30)return 'Build some chemistry first (30+).';
 if(kind==='steal'&&r.spaceUntil>dateOf(s))return 'They asked for space.';
 if((s.energy??100)<(kind==='steal'?20:15))return `Needs ${kind==='steal'?20:15} energy.`;
 return '';
}
export function viceAction(s,catalogue,p,kind){
 const why=viceReason(s,p,kind);if(why)throw Error(why);
 const r=bond(s,p),them=p.socialLife.partnerName||'their partner',x=roll(s),traits=p.lifePersonality||{};
 if(kind==='steal'){
  s.energy-=20;
  const chance=limit((r.chemistry*.45+r.friendship*.25+(r.affection||0)*.4+(r.dating?20:0)-30)/100-(traits.intention==='casual'?.1:0)+(traits.independence>65?.05:0),.05,.85);
  if(x<chance){const old=them;p.formerPartner=old;makeOpen(s,p);r.affection=limit((r.affection||0)+15);r.trust=limit((r.trust||30)+5);noteCheating(s,p,'steal');s.publicSightings?.push({from:s.activeId,with:p.id,date:dateOf(s),type:'outing'});
   const extra=tabloid(s,p,`"${p.name} leaves ${old}" is everywhere by morning.`);remember(s,p,'They chose you',`${p.name} ends things with ${old} to be with you.${extra}`);
   return {title:`${p.name} chose you`,body:`${p.name} leaves ${old} for you.${r.affair?' You are still with someone else, so for now this is an affair.':' You are officially together.'}${extra}`,ok:true}}
  r.chemistry=limit(r.chemistry-10);r.friendship=limit(r.friendship-8,-100,100);r.spaceUntil=plusDays(dateOf(s),21);remember(s,p,'Turned down',`${p.name} says they are staying with ${them}.`);
  return {title:'Not leaving',body:`${p.name} tells you they are staying with ${them} and asks for some space.`,ok:false};
 }
 if(kind==='sabotage'){
  s.energy-=15;
  if(x<.22){r.friendship=limit(r.friendship-30,-100,100);r.trust=limit((r.trust||30)-20);const extra=tabloid(s,p,'Somebody leaks that you were behind it.');remember(s,p,'Caught meddling',`${p.name} finds out you tried to break them up with ${them}.${extra}`);return {title:'You got caught',body:`${p.name} found out you were spreading rumours about ${them}. They are furious.${extra}`,ok:false}}
  if(x<.22+.33+(r.friendship>=50?.1:0)){p.socialLife={status:'single',partnerName:null,lastChange:dateOf(s)};remember(s,p,'Their relationship ends',`${p.name} and ${them} have split up.`);return {title:'They split up',body:`The rumours about ${them} did their job. ${p.name} is single.`,ok:true}}
  return {title:'Nothing happened',body:`${p.name} and ${them} seem as solid as ever. For now.`,ok:false};
 }
 throw Error('Unknown action.');
}

// ------------------------------------------------------------------ crime
export const crimes=[
 {id:'shoplift',charge:'shoplifting',name:'Shoplift',minAge:14,energy:10,blurb:'Small cash, small risk',success:.75,caught:.5,payout:[30,250],severity:'minor'},
 {id:'graffiti',charge:'vandalism',name:'Tag a wall',minAge:14,energy:10,blurb:'A thrill, not much else',success:.85,caught:.4,payout:[0,0],severity:'minor',happy:5},
 {id:'pickpocket',charge:'theft',name:'Pickpocket a tourist',minAge:16,energy:15,blurb:'Quick fingers',success:.6,caught:.5,payout:[40,600],severity:'minor'},
 {id:'bootleg',charge:'film piracy',name:'Sell bootlegs of your films',minAge:18,energy:15,blurb:'Pays more the more famous you are',success:.7,caught:.4,payout:[500,4000],fameScale:true,severity:'medium',needs:'credit'},
 {id:'burglary',charge:'burglary',name:'Burgle a mansion',minAge:18,energy:25,blurb:'Big payout, real risk',success:.55,caught:.6,payout:[1500,25000],severity:'medium'},
 {id:'gta',charge:'car theft',name:'Steal a car',minAge:18,energy:25,blurb:'Sell it to a chop shop',success:.5,caught:.6,payout:[3000,30000],severity:'medium'},
 {id:'insurance',charge:'insurance fraud',name:'Fake an insurance claim',minAge:18,energy:15,blurb:'Easy money from your insurer',success:.6,caught:.5,payout:[5000,60000],severity:'medium',needs:'asset'},
 {id:'bribe',charge:'bribery',name:'Bribe a casting director',minAge:18,energy:10,blurb:'Buy yourself a role',success:.6,caught:.45,cost:8000,severity:'medium',career:true},
 {id:'taxes',charge:'tax evasion',name:'Hide income from the taxman',minAge:21,energy:0,blurb:'Keep more of what you earn',success:.7,caught:.7,severity:'serious',needs:'rich'},
 {id:'heist',charge:'bank robbery',name:'Rob a bank',minAge:21,energy:40,blurb:'Life-changing money, or life in prison',success:.18,caught:.75,payout:[100000,2500000],severity:'serious'},
];
const sentences={minor:[0,0],medium:[6,30],serious:[36,120]};
export function crimeReason(s,c){
 const age=ageOf(s);if(s.complete)return 'This life has ended.';
 if(inPrison(s))return 'You are already in prison.';
 if(age<c.minAge)return `From age ${c.minAge}.`;
 if((s.energy??100)<c.energy)return `Needs ${c.energy} energy.`;
 if(c.cost&&s.money<cash(s,c.cost))return `Costs ${fmt(cash(s,c.cost))}.`;
 if(c.needs==='credit'&&!s.filmography.some(f=>f.personId===s.activeId&&f.status==='released'))return 'You need a released film first.';
 if(c.needs==='asset'&&!(s.possessions||[]).some(p=>p.ownerId===s.activeId&&['car','home'].includes(assets.find(a=>a.id===p.id)?.kind)))return 'You need to own a car or a home.';
 if(c.needs==='rich'&&s.money<cash(s,50000))return 'You need $50,000+ in the bank.';
 return '';
}
export function commitCrime(s,catalogue,id){
 const c=crimes.find(x=>x.id===id);if(!c)throw Error('Unknown crime.');const why=crimeReason(s,c);if(why)throw Error(why);
 s.energy=(s.energy??100)-c.energy;const x=roll(s),age=ageOf(s);
 if(c.cost)s.money-=cash(s,c.cost);
 if(x<c.success){
  if(c.id==='bribe'){const o=available(s,catalogue).filter(o=>o.fit>50).sort((a,b)=>b.fit-a.fit)[0];if(!o)return {title:'Money well wasted',body:'The casting director takes the envelope, but there is nothing casting that suits you right now.'};const offer=makeOffer(s,o.project,o.index,{source:'studio'});return {title:'The envelope worked',body:`Funny how things work out: ${o.project.title} offers you ${offer.character}. Check Offers & deals.`}}
  if(c.id==='taxes'){const saved=Math.round(s.money*.12);s.money+=saved;return {title:'Offshore and off the books',body:`You save ${fmt(saved)} in tax. The paper trail is out there somewhere.`}}
  let gain=c.payout?Math.round(cash(s,between(s,c.payout))*(c.fameScale?1+s.fame/10:1)):0;s.money+=gain;if(c.happy)nudge(s,{happiness:c.happy});
  const lines={shoplift:'You walk out with it under your jacket.',graffiti:'Your tag is the first thing people see on the high street.',pickpocket:'They never felt a thing.',bootleg:'Market stalls cannot keep your films in stock.',burglary:'In and out before the alarm company calls back.',gta:'The chop shop pays cash, no questions asked.',insurance:'The claim goes through without a single phone call.',heist:'The vault, the van, the getaway. It actually worked.'};
  return {title:'You got away with it',body:`${lines[c.id]}${gain?` You made ${fmt(gain)}.`:''}`};
 }
 if(roll(s)>c.caught)return {title:'It fell through',body:'You lose your nerve and walk away. Nobody saw anything.'};
 // caught
 const rec=criminalRecord(s);
 if(c.id==='bribe'){careerProfile(s).reputation=limit(careerProfile(s).reputation-25);}
 if(age<18){rec.push({date:dateOf(s),crime:c.charge,juvenile:true});const strikes=rec.filter(r=>r.juvenile).length;for(const p of s.people.filter(p=>p.relative==='Parent'&&p.alive))bond(s,p).friendship=limit(bond(s,p).friendship-10,-100,100);
  if(strikes>=3){jail(s,catalogue,4,c.charge);return {title:'Juvenile detention',body:'Third time caught. The judge sends you to juvenile detention for four months.'}}
  return {title:'Caught by the police',body:`A police caution and a very awkward car ride home. Your parents are furious.${strikes===2?' One more and it is juvenile detention.':''}`}}
 if(c.severity==='minor'){const fine=cash(s,300+roll(s)*700);s.money-=fine;rec.push({date:dateOf(s),crime:c.charge,convicted:true,sentence:0});const extra=tabloid(s,null,'A photo of you being escorted out of the shop goes viral.');return {title:'Caught',body:`You are fined ${fmt(fine)}.${extra}`}}
 const extra=tabloid(s,null,'Photographers are waiting outside the police station.');
 queueEvent(s,'crime',"You've been arrested",`Police charge you with ${c.charge}.${extra} How do you plead?`,[choice('lawyer',`Hire a top lawyer (${fmt(cash(s,25000))})`),choice('public','Use a public defender'),choice('guilty','Plead guilty for a shorter sentence')],{kind:'arrest',crime:c.charge,severity:c.severity});
 return {title:'Busted',body:'Blue lights. Handcuffs. You are under arrest.'};
}
export function jail(s,catalogue,months,crime){
 const date=dateOf(s),until=plusDays(date,Math.round(months*30.44)),a=active(s);
 s.prison={personId:s.activeId,since:date,until,crime,months,behaviour:0,lastAppeal:null};
 let lost=0;
 for(const c of s.filmography.filter(f=>f.personId===a.id&&['booked','filming'].includes(f.status))){c.status='withdrawn';lost++;if(Number.isInteger(c.roleIndex)&&s.casts[`${c.projectId}:${c.roleIndex}`]===a.name)delete s.casts[`${c.projectId}:${c.roleIndex}`]}
 for(const o of pendingOffers(s))o.status='declined';
 for(const x of (s.applications||[]).filter(x=>x.personId===a.id&&['watching','considering','invited','callback','offered'].includes(x.status)))x.status='withdrawn';
 for(const t of (s.tvCareers||[]).filter(t=>t.personId===a.id&&t.status==='active')){t.status='left';t.leftOn=date;t.next=null}
 for(const k of (s.contracts||[]).filter(k=>k.personId===a.id&&k.status==='active'))try{terminateContract(s,k.id,'a prison sentence')}catch{}
 careerProfile(s).reputation=limit(careerProfile(s).reputation-20);ensureOverhaul(s).publicImage=limit(ensureOverhaul(s).publicImage-15);
 for(const p of exclusivePartners(s)){const r=bond(s,p);if(r.status!=='married'&&roll(s)<.4)endRelationship(s,p,{byThem:true,why:`${p.name} cannot wait for you.`,reason:'your prison sentence'})}
 nudge(s,{happiness:-20});
 feed(s,'Prison',`Sentenced to ${months} months for ${crime}.${lost?` You lose ${lost} ${lost===1?'role':'roles'}.`:''}`);
}
export const prisonActivities=[
 {id:'yard',name:'Work out in the yard',energy:15,blurb:'Health and looks'},
 {id:'library',name:'Prison library',energy:10,blurb:'Happiness, a little drama'},
 {id:'drama',name:'Run the prison drama group',energy:15,blurb:'Acting and good behaviour'},
 {id:'behave',name:'Keep your head down',energy:10,blurb:'Good behaviour shortens your sentence'},
 {id:'appeal',name:'File an appeal',energy:0,cost:15000,blurb:'Costly; might get you out'},
 {id:'escape',name:'Attempt an escape',energy:30,blurb:'Very unlikely to work'},
];
export function prisonReason(s,a){if(!inPrison(s))return 'You are not in prison.';if((s.energy??100)<a.energy)return `Needs ${a.energy} energy.`;if(a.cost&&s.money<cash(s,a.cost))return `Costs ${fmt(cash(s,a.cost))}.`;if(a.id==='appeal'&&s.prison.lastAppeal&&daysBetween(s.prison.lastAppeal,dateOf(s))<90)return 'Your last appeal was too recent.';return ''}
function shorten(s,days){s.prison.until=plusDays(s.prison.until,-days);if(s.prison.until<=dateOf(s))s.prison.until=plusDays(dateOf(s),1)}
export function prisonActivity(s,id){
 const a=prisonActivities.find(x=>x.id===id),why=a&&prisonReason(s,a);if(!a)throw Error('Unknown activity.');if(why)throw Error(why);
 s.energy-=a.energy;const x=roll(s);
 switch(id){
  case 'yard':nudge(s,{health:3,looks:1,happiness:1});return {title:'Yard time',body:x<.1?'Someone picks a fight. You walk away, just.':'Push-ups, pull-ups and a lot of thinking.'};
  case 'library':nudge(s,{happiness:3});s.skills.drama=limit(s.skills.drama+1);return {title:'The library',body:'Old paperbacks and a surprising amount of Shakespeare.'};
  case 'drama':s.skills.acting=limit(s.skills.acting+2);s.prison.behaviour++;shorten(s,4);return {title:'Prison drama group',body:'Your production of Twelve Angry Men gets a standing ovation from the guards.'};
  case 'behave':s.prison.behaviour++;shorten(s,7);return {title:'Good behaviour',body:'The guards notice. Your release date moves a little closer.'};
  case 'appeal':s.money-=cash(s,a.cost);s.prison.lastAppeal=dateOf(s);if(x<.2){release(s,'Your appeal succeeds.');return {title:'Appeal granted',body:'The conviction is overturned. You are free.'}}return {title:'Appeal denied',body:'The judge is not convinced. You can try again in three months.'};
  case 'escape':if(x<.07){const left=Math.max(1,daysBetween(dateOf(s),s.prison.until));s.prison=null;s.wanted={personId:s.activeId,days:left*2};nudge(s,{happiness:10});feed(s,'Escaped','You are out, and you are a wanted fugitive.');return {title:'You escaped!',body:'Over the wall and gone. You are free, but the police are looking for you.'}}s.prison.until=plusDays(s.prison.until,365);s.prison.behaviour=0;nudge(s,{health:-8,happiness:-6});return {title:'Caught at the fence',body:'The escape fails. A year is added to your sentence.'};
 }
}
function release(s,why){const months=s.prison?.months;s.prison=null;nudge(s,{happiness:15});feed(s,'Released',`${why} Prison is behind you.`);return months}

// ------------------------------------------------------------- weekly tick
export function viceTick(s,catalogue,days=7){
 if(s.complete)return;const date=dateOf(s),weeks=Math.max(1,days/7);
 // prison
 if(s.prison&&s.prison.personId===s.activeId){
  if(date>=s.prison.until){const served=release(s,'You walk out of the gates.');queueEvent(s,'crime','You are free',`After ${served||'many'} months, the gates open. Your criminal record will follow you around casting rooms for a while.`,[choice('ack','Breathe the fresh air')],{kind:'ack'});return}
  nudge(s,{happiness:-1.2*weeks});
  if(!openLifeEvent(s)&&roll(s)<.05*weeks)queueEvent(s,'crime','Trouble in the yard','A fight breaks out next to you and someone shoves you.',[choice('avoid','Walk away'),choice('join','Fight back')],{kind:'yard'});
  return;
 }
 if(s.wanted&&s.wanted.personId===s.activeId&&roll(s)<.03*weeks){const months=Math.round(s.wanted.days/30.44);s.wanted=null;jail(s,catalogue,Math.max(6,months),'escaping from prison');queueEvent(s,'crime','Recaptured','Police find you. You are back inside, with extra time for escaping.',[choice('ack','Back to the cell')],{kind:'ack'});return}
 // cheating discovery
 for(const p of exclusivePartners(s)){const r=bond(s,p);if(!r.suspicion)continue;
  if(!openLifeEvent(s)&&roll(s)<Math.min(.5,r.suspicion/260*weeks*(1+s.fame/150))){const other=r.cheatedWith||'someone else';queueEvent(s,'affair',`${p.name} found out`,`${p.name} has seen your messages with ${other}.${s.fame>=35?' The tabloids are already sniffing around.':''}`,[choice('confess','Confess and apologise'),choice('deny','Deny everything'),choice('leave',`Leave ${p.name} for ${other}`)],{kind:'caught',personId:p.id,other});break}
  r.suspicion=Math.max(0,r.suspicion-1.5*weeks);
 }
 // their partner discovers the affair
 for(const p of s.people.filter(p=>p.alive&&s.relationships?.[p.name]?.exposure>0&&isTaken(s,p))){const r=bond(s,p);
  if(!openLifeEvent(s)&&roll(s)<Math.min(.4,r.exposure/320*weeks)){queueEvent(s,'affair',`${p.socialLife.partnerName||'Their partner'} knows`,`${p.socialLife.partnerName||`${p.name}'s partner`} has found out about you and ${p.name}.`,[choice('fight',`Ask ${p.name} to choose you`),choice('lie','Help them cover it up'),choice('back','Back off for good')],{kind:'exposed',personId:p.id});r.exposure=0;break}
  r.exposure=Math.max(0,r.exposure-1.5*weeks);
 }
 // an affair partner pushes for more
 if(!openLifeEvent(s)&&exclusivePartners(s).length){const lover=s.people.find(p=>p.alive&&s.relationships?.[p.name]?.dating&&s.relationships[p.name].affair&&!isTaken(s,p)&&daysBetween(s.relationships[p.name].datingSince||date,date)>45);if(lover&&roll(s)<.03*weeks){const main=exclusivePartners(s,lover)[0];queueEvent(s,'affair',`${lover.name} wants more`,`${lover.name} is tired of being a secret and wants you to leave ${main.name}.`,[choice('leave',`Leave ${main.name}`),choice('stay','Ask them to be patient'),choice('end',`End things with ${lover.name}`)],{kind:'ultimatum',personId:lover.id,mainId:main.id})}}
 // your partner cheats on you
 if(!openLifeEvent(s))for(const p of exclusivePartners(s)){const r=bond(s,p),casual=p.lifePersonality?.intention==='casual';const risk=(.0015+(r.tension||0)/12000+((r.affection??50)<30?.003:0))*(casual?2:1)*weeks;if(r.forgaveOn&&daysBetween(r.forgaveOn,date)<180)continue;if(roll(s)<risk){queueEvent(s,'affair','Something is off',`You find messages on ${p.name}'s phone. They have been seeing someone behind your back.`,[choice('confront','Confront them'),choice('forgive','Forgive them'),choice('leave','Leave them')],{kind:'their-affair',personId:p.id});break}}
}

// --------------------------------------------------------------- resolution
export function resolveVice(s,catalogue,e,answer){
 const d=e.data||{},p=d.personId&&s.people.find(x=>x.id===d.personId),r=p&&bond(s,p),x=roll(s);
 if(d.kind==='ack')return '';
 if(e.type==='crime'&&d.kind==='arrest'){
  let lawyer=answer==='lawyer',note='';const fee=cash(s,25000);
  if(lawyer&&s.money<fee){lawyer=false;note='You cannot afford the lawyer, so a public defender takes the case. '}else if(lawyer)s.money-=fee;
  const convict=answer==='guilty'||x<(lawyer?.3:.65),range=sentences[d.severity]||[6,24];
  const rec=criminalRecord(s);
  if(!convict){rec.push({date:dateOf(s),crime:d.crime,convicted:false});nudge(s,{happiness:10});return `${note}Not guilty. You walk out of court a free person.`}
  const months=Math.max(3,Math.round(between(s,range)*(answer==='guilty'?.6:1)));rec.push({date:dateOf(s),crime:d.crime,convicted:true,sentence:months});
  jail(s,catalogue,months,d.crime);return `${note}Guilty. You are sentenced to ${months} months in prison.${s.fame>=30?' It is front-page news.':''}`;
 }
 if(e.type==='crime'&&d.kind==='yard'){if(answer==='join'){nudge(s,{health:-6});if(s.prison){s.prison.behaviour=0;s.prison.until=plusDays(s.prison.until,60)}return 'You win the fight and lose two months of good behaviour.'}if(s.prison)s.prison.behaviour++;return 'You walk away. The guards notice.'}
 if(e.type!=='affair'||!p)return '';
 if(d.kind==='caught'){const other=s.people.find(x=>x.name===d.other);
  if(answer==='confess'){const forgive=limit(((r.trust||40)+(r.commitment||30))/250-(r.betrayals||0)*.15,.1,.75);r.betrayals=(r.betrayals||0)+1;r.suspicion=0;
   if(x<forgive){r.trust=limit((r.trust||40)-25);r.tension=limit((r.tension||0)+30);r.forgaveOn=dateOf(s);nudge(s,{happiness:-6});return `${p.name} is devastated, but agrees to try again. Trust will take a long time to rebuild.`+tabloid(s,p)}
   endRelationship(s,p,{byThem:true,why:`${p.name} cannot forgive you.`,reason:'you cheated'});return `${p.name} ends it.`+tabloid(s,p,'"Caught cheating" headlines follow you for weeks.')}
  if(answer==='deny'){if((r.suspicion||0)<70&&x<.5){r.suspicion=Math.max(0,(r.suspicion||0)-25);r.tension=limit((r.tension||0)+10);return `${p.name} wants to believe you. For now, they do.`}r.suspicion=0;endRelationship(s,p,{byThem:true,why:`${p.name} knows you are lying.`,reason:'you cheated and lied about it'});return `${p.name} has the screenshots. Lying makes it worse, and they leave you.`+tabloid(s,p)}
  r.suspicion=0;endRelationship(s,p,{why:`You leave ${p.name}.`,reason:'you left them for someone else'});if(other&&s.relationships[other.name]?.dating&&!isTaken(s,other))makeOpen(s,other);return `You leave ${p.name}.${other&&!isTaken(s,other)?` You and ${other.name} are now out in the open.`:''}`+tabloid(s,p);
 }
 if(d.kind==='exposed'){const them=p.socialLife?.partnerName||'their partner';
  if(answer==='fight'){if(x<limit((r.chemistry+(r.affection||0)+r.friendship)/300,.15,.8)){p.formerPartner=them;makeOpen(s,p);remember(s,p,'They chose you',`${p.name} leaves ${them} for you.`);return `${p.name} leaves ${them} and chooses you.`+tabloid(s,p)}recordBreakup(s,r,'them','they stayed with their partner');r.dating=false;r.affair=false;r.status='ex';r.spaceUntil=plusDays(dateOf(s),60);nudge(s,{happiness:-8});remember(s,p,'They chose their partner',`${p.name} stays with ${them} and ends things with you.`);return `${p.name} chooses ${them}. It is over between you.`}
  if(answer==='lie'){if(x<.5)return 'The cover story holds. Barely.';p.socialLife={status:'single',partnerName:null,lastChange:dateOf(s)};if(r.dating&&!exclusivePartners(s,p).length){makeOpen(s,p);return `${them} does not buy it and leaves ${p.name}. You two are free to be together.`}return `${them} does not buy it and leaves ${p.name}.`}
  recordBreakup(s,r,'you','it was getting messy');r.dating=false;r.affair=false;r.status='ex';r.friendship=limit(r.friendship-10,-100,100);return `You end things with ${p.name} before it gets any messier.`;
 }
 if(d.kind==='ultimatum'){const main=s.people.find(x=>x.id===d.mainId);
  if(answer==='leave'&&main){endRelationship(s,main,{why:`You leave ${main.name} for ${p.name}.`,reason:'you left them for someone else'});makeOpen(s,p);return `You leave ${main.name}. You and ${p.name} are together, openly.`+tabloid(s,p)}
  if(answer==='stay'){r.tension=limit((r.tension||0)+20);if(x<.3){recordBreakup(s,r,'them','tired of being a secret');r.dating=false;r.affair=false;r.status='ex';return `${p.name} is done waiting and ends it.`}return `${p.name} agrees to wait, unhappily.`}
  recordBreakup(s,r,'you','you ended the affair');r.dating=false;r.affair=false;r.status='ex';r.spaceUntil=plusDays(dateOf(s),60);return `You end the affair with ${p.name}.`;
 }
 if(d.kind==='their-affair'){
  if(answer==='forgive'){r.trust=limit((r.trust||40)-20);r.tension=limit((r.tension||0)+15);r.forgaveOn=dateOf(s);nudge(s,{happiness:-8});return `You forgive ${p.name}. It still hurts.`}
  if(answer==='confront'){if(x<.5){r.trust=limit((r.trust||40)-10);r.forgaveOn=dateOf(s);nudge(s,{happiness:-5});return `${p.name} breaks down, ends the other relationship and begs for another chance.`}endRelationship(s,p,{byThem:true,why:`${p.name} admits it and leaves you for the other person.`,reason:'they cheated'});return `${p.name} admits everything, and leaves you for them.`}
  endRelationship(s,p,{why:`You leave ${p.name} after finding out they cheated.`,reason:'they cheated'});return `You leave ${p.name}.`;
 }
 return '';
}
export function viceStatus(s){if(inPrison(s))return 'Inmate';if(s.wanted?.personId===s.activeId)return 'Fugitive';return null}
