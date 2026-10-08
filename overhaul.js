import {active,available,currentDate,projectSchedule,roleFit,projectPhase,ensurePerson,person,uniqueName,castFor,rand} from './engine.js?v=15';
import {ensureCareer,careerProfile,pendingOffers,makeOffer,startAudition,attendCallback,offerConflict,resolveProductionEvent,prepareAudition} from './career.js?v=15';
import {bond,personality,personAge,romanceAllowed,interact} from './relationships.js?v=15';
import {ensureOverhaul,roleAssessment,projectReach,typecastPressure,knownFor,dateOf,plusDays,daysBetween,limit,fingerprint,feed,queueEvent,openLifeEvent,castingReason,syncCalendar,reserve,calendarReason,economyTick,assets,eraValue,lifestyles,monthlyCosts,characterIdentity} from './game-rules.js?v=15';

const all=(s,c)=>[...new Map([...c,...s.projects].map(p=>[p.id,p])).values()];
const production=(s,c,id)=>all(s,c).find(p=>p.id===id);
const choice=(id,label)=>({id,label});
const living=s=>s.people.filter(p=>p.alive&&p.id!==s.activeId&&!p.relative);
function remember(s,p,title,body){const r=bond(s,p);r.memories.unshift({date:currentDate(s),title,body});r.memories=r.memories.slice(0,32);feed(s,`${title} · ${p.name}`,body)}
export function migrateOverhaul(s,catalogue){
 const fresh=s.overhaulVersion!==5;ensureCareer(s);const profile=ensureOverhaul(s);syncCalendar(s,all(s,catalogue),projectSchedule);
 if(fresh){
  const released=s.filmography.filter(c=>c.personId===s.activeId&&c.status==='released');let floor=s.fame;
  for(const c of released){const existing=production(s,catalogue,c.projectId),p=existing||{id:c.projectId,title:c.title,year:c.year,kind:c.kind,seriesId:c.seriesId,collectionId:c.collectionId,genre:c.genre||'Drama',baselineRating:(c.outcome?.reception||60)/10,voteCount:c.tvCareerId?10000:100,roles:[{character:c.role,actor:c.original}]};const a=roleAssessment(s,p,existing?(c.roleIndex||Math.max(0,p.roles.findIndex(r=>r.character===c.role))):0);const key=`${p.seriesId||p.collectionId||p.id}:${characterIdentity(c.role)}`,prior=profile.identities[key];floor=Math.max(floor,Math.round(a.reach*a.prominence/250+Math.min(20,(prior?.productions||0)*6)));profile.identities[key]={character:c.role,genre:p.genre||'Drama',strength:Math.min(90,(prior?.strength||0)+a.reach*a.prominence/250),productions:(prior?.productions||0)+1}}
  if(floor>s.fame){s.fame=floor;feed(s,'Your public recognition','Your recognition now reflects the reach of your already released work. Existing payments are preserved.')}
  s.notifications=[];
 }
 return s;
}
export function applyRole(s,catalogue,p,index,{watch=false}={}){
 ensureOverhaul(s);if(!p?.roles[index]||s.complete)throw Error('This role is unavailable.');
 if(roleFit(s,p,p.roles[index])<=50)throw Error('Applications require more than 50% fit.');
 const taken=castingReason(s,p,index);if(taken)throw Error(taken);
 const phase=projectPhase(s,p);if(watch&&phase!=='Announced'||!watch&&phase!=='Casting')throw Error(watch?'This project is not announced.':'Casting is not open.');
 if(offerConflict(s,catalogue,p))throw Error('The filming dates conflict with an accepted commitment.');
 if(s.casts[`${p.id}:${index}`]||s.choices.includes(`${p.id}:${index}`))throw Error('This part has already been decided.');
 const existing=s.applications.find(a=>a.personId===s.activeId&&a.projectId===p.id&&a.index===index&&!['rejected','expired','withdrawn'].includes(a.status));if(existing)return existing;
 const end=projectSchedule(p).castingEnd,a={id:`application-${s.nextId++}`,personId:s.activeId,projectId:p.id,year:p.year,title:p.title,index,character:p.roles[index].character,status:watch?'watching':'considering',appliedOn:currentDate(s),readyOn:[plusDays(currentDate(s),7),plusDays(end,-1)].sort()[0],expiresOn:end};
 s.applications.push(a);feed(s,watch?'Interest registered':'Application submitted',`${p.title} · ${a.character}. ${watch?'You will be notified when casting opens.':'The casting team will review your profile.'}`);return a;
}
export function submitAudition(s,catalogue,id,{forceWin=false}={}){
 const a=s.applications.find(a=>a.id===id&&a.personId===s.activeId),p=a&&production(s,catalogue,a.projectId);
 if(!a||!p||a.status!=='invited'&&!forceWin)throw Error('There is no audition invitation for this role.');
 const out=startAudition(s,catalogue,p,a.index,{forceWin});a.status=out.stage==='offer'?'offered':out.stage==='callback'?'callback':'rejected';
 if(out.callback){out.callback.automatic=true;a.callbackId=out.callback.id;out.callback.chemistryRead=roleAssessment(s,p,a.index).prominence>=65&&projectReach(p)>=55;}
 if(out.offer)a.offerId=out.offer.id;return out;
}
export function forceRole(s,catalogue,p,index){let a=s.applications.find(a=>a.personId===s.activeId&&a.projectId===p.id&&a.index===index&&!['rejected','expired'].includes(a.status));if(!a)a=applyRole(s,catalogue,p,index);return submitAudition(s,catalogue,a.id,{forceWin:true})}
export function applicationTick(s,catalogue){
 const date=currentDate(s),profile=careerProfile(s),eligible=new Set(available(s,catalogue,{includePending:true}).map(o=>`${o.project.id}:${o.index}`));
 for(const a of s.applications.filter(a=>a.personId===s.activeId)){
  const p=production(s,catalogue,a.projectId);if(!p)continue;
  if(['watching','considering','invited','callback'].includes(a.status)&&date>=a.expiresOn){a.status='expired';continue}
  if(a.status==='watching'&&projectPhase(s,p)==='Casting'){
   a.status=eligible.has(`${p.id}:${a.index}`)?'considering':'withdrawn';a.readyOn=date;
   queueEvent(s,'casting',a.status==='considering'?'Casting has opened':'Your watched role is unavailable',`${p.title} · ${a.character}. ${a.status==='considering'?'Your registered interest is now an application.':'The part is taken or its schedule no longer fits.'}`,[choice('ack','Continue')],{applicationId:a.id},`watch-${a.id}`);
  }
  if(a.status==='considering'&&date>=a.readyOn){
   const score=roleFit(s,p,p.roles[a.index])*.28+s.skills.acting*.22+profile.reputation*.22+(profile.agent?.level||0)*4+s.fame*.12-typecastPressure(s,p,a.index);
   if(!eligible.has(`${p.id}:${a.index}`)||rand(s)>limit(score/100,.12,.9)){a.status='rejected';feed(s,'Application decision',`${p.title} is not inviting you to audition for ${a.character}.`)}
   else{a.status='invited';queueEvent(s,'casting','An audition invitation',`${p.title} wants to see your audition for ${a.character}. Prepare and submit it through your application.`,[choice('ack','Review my application')],{applicationId:a.id},`invited-${a.id}`)}
  }
  if(a.status==='callback'){
   const callback=s.careerAuditions.find(x=>x.id===a.callbackId);
   if(callback?.status==='callback'&&date>=callback.readyOn){
    try{const out=attendCallback(s,catalogue,callback.id);a.status=out.stage==='offer'?'offered':'rejected';if(out.offer)a.offerId=out.offer.id;queueEvent(s,'casting',out.offer?'Your audition was successful':'The casting decision',`${a.title} · ${a.character}. ${out.offer?'Review the offer and its terms before accepting.':'The production chose another performer.'}${callback.chemistryRead?' The callback included a chemistry read with a potential co-star.':''}`,[choice('ack','Continue')],{applicationId:a.id},`decision-${a.id}`)}catch{callback.status='expired';a.status='expired'}
   }
  }
  if(a.status==='offered'){const offer=s.roleOffers.find(o=>o.id===a.offerId);if(offer&&offer.status!=='offered')a.status=offer.status}
 }
 s.applications=s.applications.filter(a=>!['rejected','expired','declined','withdrawn','accepted'].includes(a.status)||daysBetween(a.appliedOn,date)<90);
}
export function featuredOpportunities(s,catalogue){
 const applications=s.applications.filter(a=>a.personId===s.activeId),pursued=new Set(applications.filter(a=>!['rejected','expired','withdrawn','declined'].includes(a.status)).map(a=>`${a.projectId}:${a.index}`));
 const pool=available(s,catalogue).filter(o=>!pursued.has(`${o.project.id}:${o.index}`)),chosen=[],used=new Set();
 const take=(items,label)=>{const o=items.find(o=>!used.has(o.project.id));if(o){chosen.push({...o,label});used.add(o.project.id)}};
 take(pool,'Strong fit');take(pool,'Strong fit');
 take([...pool].sort((a,b)=>{const x=roleAssessment(s,a.project,a.index),y=roleAssessment(s,b.project,b.index);return y.reach*y.prominence-x.reach*x.prominence}),'Breakthrough potential');
 const offer=pendingOffers(s).find(o=>s.fame>=50||o.forced||o.tvCareerId||o.contractId);
 const priority={invited:0,offered:1,callback:2,considering:3,watching:4},application=applications.filter(a=>a.status in priority&&(!offer||a.offerId!==offer.id)).sort((a,b)=>priority[a.status]-priority[b.status])[0];
 return {recommendations:chosen,offer,application};
}
export function socialProfile(s,p){
 const h=fingerprint(p.name);p.lifePersonality??={affection:25+h%71,independence:20+(h>>>3)%76,ambition:20+(h>>>7)%76,jealousy:10+(h>>>11)%76,humour:20+(h>>>15)%76,intention:['long-term','casual','undecided'][h%3]};
 if(!p.socialLife){const age=personAge(s,p),taken=!p.relative&&age>=13&&h%5===0;p.socialLife={status:taken?(age<18||h%2?'dating':'married'):'single',partnerName:taken?['Alex','Taylor','Jamie','Robin'][h%4]+' '+['Hayes','Ward','Price','Chen'][(h>>>3)%4]:null,lastChange:currentDate(s)}}
 const r=bond(s,p);if(r.dating){p.socialLife.partnerId=s.activeId;p.socialLife.partnerName=active(s).name;p.socialLife.status=r.status==='dating'?'dating':r.status}else if(p.socialLife.partnerId===s.activeId)p.socialLife={status:'single',partnerName:null,lastChange:currentDate(s)};
 r.trust??=Math.max(20,r.friendship*.7);r.affection??=r.dating?40:0;r.compatibility??=35+(fingerprint(active(s).name+':'+p.name)%61);r.datingSince??=r.dating?r.met||currentDate(s):null;
 return p.lifePersonality;
}
export function socialAction(s,catalogue,p,kind){
 const traits=socialProfile(s,p),r=bond(s,p),date=currentDate(s),adult=romanceAllowed(s,p,{adult:true});
 if(['holiday','move-in','engage','marry'].includes(kind)&&(!adult||!r.dating))throw Error('These decisions require an adult relationship.');
 if(['flirt','date','hookup','reconcile'].includes(kind)&&p.socialLife.status!=='single'&&!r.dating)throw Error(`${p.name} is already ${p.socialLife.status}.`);
 if(kind==='holiday'){
  const reason=calendarReason(s,date,plusDays(date,7));if(reason)throw Error(reason);if(p.busyUntil>date)throw Error('They are busy with work.');const cost=Math.round(1800*eraValue(s.year));if(s.money<cost)throw Error(`A holiday costs $${cost}.`);
  s.money-=cost;reserve(s,{id:`trip-${s.nextId++}`,title:`Holiday with ${p.name}`,start:date,end:plusDays(date,7),kind:'holiday',guestId:p.id});r.trust=limit(r.trust+8);r.affection=limit(r.affection+10);r.tension=limit(r.tension-20);r.lastQuality=date;remember(s,p,'A shared holiday','You make room in both your lives for time away together.');return 7;
 }
 if(['move-in','engage','marry'].includes(kind)){
  if(!['committed','cohabiting','engaged','married'].includes(r.status)||r.trust<60||daysBetween(r.datingSince||date,date)<90)throw Error('Build an exclusive, trusting relationship over time first.');
  if(kind==='marry'&&r.status!=='engaged')throw Error('Discuss engagement before planning a wedding.');
  if(kind==='engage'&&['engaged','married'].includes(r.status)||kind==='marry'&&r.status==='married')throw Error('You have already taken this step.');
  if(kind==='move-in'&&r.cohabiting)throw Error('You already live together.');
  if(traits.intention==='casual'||r.compatibility+r.trust<120||rand(s)>.85){remember(s,p,'Different expectations','They are not ready for this step. You discuss what each of you wants.');r.tension=limit(r.tension+5);return 0}
  if(kind==='marry'){const cost=Math.round(5000*eraValue(s.year)),start=plusDays(date,28);if(s.money<cost)throw Error(`The wedding costs $${cost}.`);if(p.busyUntil>start)throw Error('Your partner is already committed to work on that date.');reserve(s,{id:`wedding-${s.nextId++}`,title:`Wedding with ${p.name}`,start,end:plusDays(start,1),kind:'wedding',guestId:p.id});s.money-=cost;r.weddingOn=start}
  else if(kind==='engage'){r.status='engaged';p.socialLife.status='engaged'}else{r.status='cohabiting';r.cohabiting=true}
  r.commitment=limit(r.commitment+10);remember(s,p,{ 'move-in':'Moving in together',engage:'An engagement',marry:'Planning your wedding'}[kind],'You agree on the next chapter together. Shared commitments create new responsibilities.');return 0;
 }
 if(['future','boundaries','family','hobby','quiet','support','disagree'].includes(kind)){
  const small=['future','boundaries','family','disagree'].includes(kind);if(!small&&s.energy<15)throw Error('You need 15 energy.');
  if(r.deepTalkDate===date&&small){remember(s,p,'A familiar conversation','You keep talking, but meaningful changes take time and new experiences.');return 0}
  r.deepTalkDate=date;if(!small)s.energy-=15;
  if(kind==='disagree'){r.tension=limit(r.tension+8);r.trust=limit(r.trust-(traits.independence>60?0:4));remember(s,p,'An honest disagreement','You express a different view. Your disagreement becomes part of how you understand each other.')}
  else{const gain=r.compatibility>=60?5:2;r.trust=limit(r.trust+gain);r.friendship=limit(r.friendship+gain,-100,100);if(r.dating){r.affection=limit(r.affection+gain);s.health=limit(s.health+1);r.lastQuality=date;r.tension=limit(r.tension-6)}remember(s,p,{future:'Talking about the future',boundaries:'Discussing boundaries',family:'Family stories',hobby:'A shared interest',quiet:'A quiet evening',support:'Showing up for them'}[kind],traits.intention==='casual'&&kind==='future'?'They value your connection but are unsure about a long-term commitment.':kind==='support'?'You listen to what they need instead of assuming every problem needs fixing.':'You learn something about their priorities and share your own. Compatibility grows through experiences, not just attraction.')}
  return 0;
 }
 const before={dating:r.dating,public:r.public,status:r.status};if(!interact(s,p,kind,{onSet:kind==='set'}))throw Error('This interaction is unavailable. Check their boundaries, age, energy or commitments.');
 if(r.dating&&!before.dating){r.datingSince=date;p.socialLife={status:'dating',partnerId:s.activeId,partnerName:active(s).name,lastChange:date};r.affection=limit(r.affection+15)}
 if(kind==='breakup'){p.socialLife={status:'single',partnerName:null,lastChange:date};r.cohabiting=false;r.trust=limit(r.trust-15)}
 if(kind==='commit'&&r.status==='committed')p.socialLife.status='exclusive';
 if(['walk','outing','date'].includes(kind)){r.trust=limit(r.trust+3);r.affection=limit(r.affection+3);if(kind!=='walk')s.publicSightings.push({from:s.activeId,with:p.id,date,type:'outing'})}
 if(kind==='public'&&before.public!==r.public){ensureOverhaul(s).publicImage=limit(ensureOverhaul(s).publicImage+(r.public?2:0));r.trust=limit(r.trust+(r.public&&personality(p).privacy?-2:3));s.publicSightings.push({from:s.activeId,with:p.id,date,type:r.public?'confirmed':'private'});feed(s,r.public?'A public relationship':'Choosing privacy',r.public?'You acknowledge your relationship together. Interest can bring support and additional scrutiny.':'You keep your relationship private. Your shared time matters more than public attention.')}
 return 0;
}
export function meetThrough(s,catalogue,route){
 const age=personAge(s,active(s)),modern=['tinder','raya'].includes(route),date=currentDate(s);
 if(modern&&(age<18||s.year<(route==='raya'?2015:2012)))throw Error('This app is unavailable in this era or at this age.');
 if(route==='raya'&&s.fame<50&&(careerProfile(s).agent?.level||0)<2)throw Error('This selective network requires 50 fame or established representation.');
 if(['party','industry','premiere'].includes(route)&&age<18)throw Error('These adult events are unavailable at your age.');
 if(s.energy<20)throw Error('You need 20 energy.');
 const dateEnd=plusDays(date,1),reason=['party','industry','premiere'].includes(route)?calendarReason(s,date,dateEnd):'';if(reason)throw Error(reason);
 const cost=modern||['community','introduction','personal-ad'].includes(route)?0:Math.round((route==='premiere'?300:100)*eraValue(s.year));if(s.money<cost)throw Error(`This event costs $${cost}.`);
 let p;
 if(['raya','industry','premiere'].includes(route)){
  const known=new Set(s.people.map(p=>p.name)),pool=all(s,catalogue).filter(p=>projectReach(p)>45).flatMap(p=>p.roles.slice(0,8).map(r=>({r,p}))).filter(({r})=>!known.has(r.actor)&&(!modern||s.year-(r.birthYear||s.year-25)>=18));
  if(pool.length){const row=pool[Math.floor(rand(s)*pool.length)];p=ensurePerson(s,row.r.actor,'Actor',row.r.birthYear,row.r.gender);p.fame=Math.max(p.fame||0,projectReach(row.p)*.6)}
 }
 if(!p){const name=uniqueName(s,'person'),targetAge=modern?Math.max(18,age+[-4,-2,0,2,4][Math.floor(rand(s)*5)]):age<18?Math.max(4,age+[-1,0,1][Math.floor(rand(s)*3)]):Math.max(18,age+[-5,-2,0,3,6][Math.floor(rand(s)*5)]);p=person(s,name,targetAge<18?'Student':['Teacher','Designer','Writer','Musician','Doctor','Other'][Math.floor(rand(s)*6)],s.year-targetAge,'',['female','male','nonbinary'][Math.floor(rand(s)*3)])}
 socialProfile(s,p);const r=bond(s,p);if(['party','industry','premiere'].includes(route))reserve(s,{id:`social-${s.nextId++}`,title:route==='premiere'?'A premiere':route==='industry'?'An industry event':'A party',start:date,end:dateEnd,kind:'social'});s.energy-=20;s.money-=cost;r.friendship=12;r.met=date;
 const label={raya:'a selective industry dating network',tinder:'a dating app',community:'a local gathering',introduction:'a friend’s introduction','personal-ad':s.year<1980?'a personal introduction':'a personal advertisement',party:'a party',industry:'an industry gathering',premiere:'a premiere'}[route]||'a social event';
 if(modern){if(p.socialLife.status!=='single'||!romanceAllowed(s,p)||rand(s)>.65){r.friendship=0;remember(s,p,'No mutual match','The app connection does not become a mutual romantic match. You can still meet other people.');return p}r.chemistry=15;remember(s,p,'A mutual match',`You match through ${label}. A conversation is the beginning, not a promise of a relationship.`)}else remember(s,p,'A new connection',`You meet through ${label}. Their life and priorities are their own.`);
 return p;
}

const workThemes=[['A scene that matters','A difficult emotional scene needs more preparation.'],['A proposed rewrite','The director wants to change an important scene.'],['A castmate needs support','A colleague is struggling with a demanding day.'],['Pressure on the schedule','Extra takes and a compressed schedule are wearing down the cast.'],['Creative disagreement','You and the director have different ideas about your character.']];
function nomination(s,c,p){
 const o=c.outcome;if(!o||o.performance<70||o.critics<60||c.overhaulLegacy)return;
 const a=roleAssessment(s,p,c.roleIndex||0),year=Math.max(s.year,Number(projectSchedule(p).releaseDate.slice(0,4)))+1;
 const names=p.kind==='TV series'?['Primetime Emmy Awards','Golden Globe Awards']:a.budget<20e6&&s.year>=1986?['Independent Spirit Awards','Academy Awards']:['Academy Awards','BAFTA Film Awards'];
 if(p.kind==='Film'&&s.year>=1985&&a.budget<15e6)names.push('Sundance festival recognition');
 for(const name of names){if(rand(s)>limit((o.performance-50)/85,.15,.6))continue;
  const ceremonyDate=`${year}-${name.includes('Emmy')?'09-15':name.includes('Sundance')?'01-25':name.includes('Golden')?'01-10':name.includes('Spirit')?'02-16':name.includes('BAFTA')?'02-23':'03-15'}`,group=`${name}:${year}`,category=name.includes('festival')?'Acting recognition':`${a.prominence>=90?'Leading':'Supporting'} performance${p.kind==='TV series'?' in television':''}`;
  const award={id:`award-${s.nextId++}`,personId:s.activeId,name,year,ceremonyDate,category,projectId:p.id,title:p.title,performance:o.performance,critics:o.critics,status:'nominated',attendance:null,guestId:null};s.awards.push(award);careerProfile(s).reputation=limit(careerProfile(s).reputation+2);ensureOverhaul(s).range=limit((ensureOverhaul(s).range||0)+2);feed(s,'An acting nomination',`${name} recognises your performance in ${p.title}. Industry reputation improves before the result; attending is your choice.`);
  let productionAward=null;if(o.critics>=80&&rand(s)<.3){productionAward={...award,id:`award-${s.nextId++}`,productionAward:true,category:p.kind==='TV series'?'Outstanding series':'Outstanding film',performance:o.critics};s.awards.push(productionAward)}
  const old=s.lifeEvents.find(e=>e.key===group&&e.personId===s.activeId);if(old){old.data.awardIds.push(award.id);old.body+=` Also nominated: ${p.title} (${category}).`;const previous=s.awards.find(a=>a.id===old.data.awardIds[0]);award.attendance=previous.attendance;award.guestId=previous.guestId}
  else queueEvent(s,'award-invitation',`Nominated: ${name}`,`${p.title} · ${category}. The ceremony is ${ceremonyDate}. The winner has not been decided. Would you like to attend?`,[choice('decline','Decline attendance'),choice('alone','Attend alone'),choice('guest','Invite someone to attend with me')],{awardIds:[award.id],ceremonyDate},group);
  if(productionAward){const invitation=s.lifeEvents.find(e=>e.key===group&&e.personId===s.activeId);invitation.data.awardIds.push(productionAward.id);invitation.body+=` The production also receives a nomination for ${productionAward.category}; this is separate from your acting nomination.`;productionAward.attendance=award.attendance;productionAward.guestId=award.guestId}
 }
}
export function guestEligible(s,p,date){return p.alive&&p.id!==s.activeId&&(p.relative||bond(s,p).friendship>=25||bond(s,p).dating)&&(!p.busyUntil||p.busyUntil<=date)}
export function resolveLifeEvent(s,catalogue,id,answer,{guestId=null}={}){
 const e=s.lifeEvents.find(e=>e.id===id&&e.personId===s.activeId&&e.status==='open');if(!e||!e.options.some(o=>o.id===answer))throw Error('This event or response is unavailable.');
 const profile=ensureOverhaul(s),p=e.data.personId&&s.people.find(p=>p.id===e.data.personId),r=p&&bond(s,p),date=currentDate(s);
 if(e.type==='award-invitation'){
  const nominations=s.awards.filter(a=>e.data.awardIds.includes(a.id)),ceremony=e.data.ceremonyDate;
  let guest=null;if(answer==='guest'){guest=s.people.find(p=>p.id===guestId);if(!guest||!guestEligible(s,guest,ceremony))throw Error('Choose an available friend, partner or family member who wants to attend.');}else guestId=null;
  if(answer!=='decline')reserve(s,{id:`ceremony-${e.key}`,title:nominations[0].name,start:ceremony,end:plusDays(ceremony,1),kind:'awards',guestId});
  const accepted=!guest||rand(s)<limit((bond(s,guest).friendship+(bond(s,guest).dating?40:10))/120,.2,.95);
  for(const a of nominations){a.attendance=answer==='decline'?'absent':'attending';a.guestId=accepted?guestId:null}
  if(guest){remember(s,guest,accepted?'An invitation accepted':'An invitation declined',accepted?'They agree to accompany you to the ceremony.':'They cannot join you this time. You can still attend alone.');const calendar=s.commitments.find(c=>c.id===`ceremony-${e.key}`);if(calendar)calendar.guestId=accepted?guestId:null}
 }
 else if(e.type==='work'){resolveProductionEvent(s,e.data.eventId,answer)}
 else if(e.type==='publicity'){
  if(answer==='attend'){reserve(s,{id:`publicity-${e.id}`,title:e.title,start:e.data.appearanceDate,end:plusDays(e.data.appearanceDate,1),kind:'publicity'});const c=s.filmography.find(c=>c.projectId===e.data.projectId&&c.personId===s.activeId);if(c)c.promotion=(c.promotion||0)+5;profile.publicImage=limit(profile.publicImage+2);s.fame=limit(s.fame+Math.min(2,(100-s.fame)/20));}else feed(s,'A quieter publicity schedule','You decline the appearance and keep the time for yourself.');
 }
 else if(e.type==='rumour'){
  if(answer==='confirm'){if(!r?.dating)throw Error('You are not dating. A rumour does not create a relationship.');if(personality(p).privacy&&r.commitment<40)throw Error('Your partner has not agreed to go public. Discuss it privately first.');r.public=true;r.trust=limit(r.trust+2);profile.publicImage=limit(profile.publicImage+2)}
  else if(answer==='deny'){if(r?.dating){r.trust=limit(r.trust-8);r.tension=limit(r.tension+8)}profile.publicImage=limit(profile.publicImage-1)}
  else if(answer==='friendship'&&r){if(r.dating){r.tension=limit(r.tension+4)}else r.trust=limit(r.trust+3)}
  else if(answer==='boundaries'&&r){r.trust=limit(r.trust+4);r.tension=limit(r.tension-5)}
 }
 else if(e.type==='relationship'&&p){
  if(answer==='accept'){if(e.data.action==='date'||e.data.action==='commit'){socialAction(s,catalogue,p,e.data.action)}else socialAction(s,catalogue,p,'quiet')}
  else if(answer==='listen'){r.trust=limit(r.trust+6);r.tension=limit(r.tension-12);r.lastQuality=date;remember(s,p,'An honest conversation','You listen and make room for their needs, even when your priorities differ.')}
  else if(answer==='boundary'){r.trust=limit(r.trust+(socialProfile(s,p).independence>55?4:-3));r.tension=limit(r.tension+3);remember(s,p,'Setting a boundary','You explain what you can offer and what you cannot promise.')}
  else{r.tension=limit(r.tension+5);remember(s,p,'Different priorities','You turn down the invitation or postpone the conversation. Their priorities remain important to them.')}
 }
 else if(e.type==='friendship'&&p){if(answer==='help'){if(s.energy<15)throw Error('You need 15 energy to give that support; an honest conversation remains available.');r.friendship=limit(r.friendship+8,-100,100);r.trust=limit(r.trust+5);s.energy=limit(s.energy-15)}else if(answer==='honest'){r.trust=limit(r.trust+3)}else r.friendship=limit(r.friendship-4,-100,100);remember(s,p,'A friendship moment','Your response becomes part of the history between you.')}
 else if(e.type==='rivalry'&&p){if(answer==='private'){p.rivalry=limit((p.rivalry||0)-8);r.respect=limit(r.respect+4)}else if(answer==='public'){p.rivalry=limit((p.rivalry||0)+10);profile.publicImage=limit(profile.publicImage-5)}else r.tension=limit(r.tension+2)}
 else if(e.type==='recast'){if(answer==='pursue'){s.recastOpportunities[`${e.data.projectId}:${e.data.index}`]=e.data.expiresOn;feed(s,'An explicit recasting opportunity',`${e.data.title} is now accepting applications for this established character.`)}}
 else if(e.type==='budget'&&answer==='reduce'){profile.lifestyle='family';feed(s,'Reducing commitments','You return to shared living while reviewing the upkeep of your possessions. Selling an asset can reduce ongoing costs.')}
 e.status='resolved';e.answer=answer;e.resolvedOn=date;profile.lastChoice=date;feed(s,e.title,`You chose: ${e.options.find(o=>o.id===answer).label}.`);
}
export function nextScheduledDate(s,end){return s.commitments.filter(c=>c.personId===s.activeId&&c.status==='scheduled'&&c.start>currentDate(s)&&c.start<=end).map(c=>c.start).sort()[0]||end}
function ceremoniesTick(s){
 const date=currentDate(s),groups=new Map();
 for(const a of s.awards.filter(a=>a.personId===s.activeId&&a.status==='nominated'&&date>=a.ceremonyDate)){if(!groups.has(a.name+':'+a.year))groups.set(a.name+':'+a.year,[]);groups.get(a.name+':'+a.year).push(a)}
 for(const [key,awards] of groups){
  const unresolved=s.lifeEvents.find(e=>e.key===key&&e.status==='open');if(unresolved)continue;
  for(const a of awards){a.status=rand(s)<limit((a.performance*.65+a.critics*.35-50)/100,.08,.45)?'won':'nominated-final';a.resultOn=date;if(a.status==='won'){careerProfile(s).reputation=limit(careerProfile(s).reputation+(a.productionAward?2:6));s.fame=limit(s.fame+Math.max(1,(a.productionAward?2:6)*(1-s.fame/110)));ensureOverhaul(s).range=limit((ensureOverhaul(s).range||0)+6)}}
  const guest=awards[0].guestId&&s.people.find(p=>p.id===awards[0].guestId);if(guest){s.publicSightings.push({from:s.activeId,with:guest.id,date,type:'red-carpet'});remember(s,guest,'An awards night','You share an important public moment, whatever the results.')}
  queueEvent(s,'award-result',`${awards[0].name}: the results`,awards.map(a=>`${a.title} · ${a.category}: ${a.status==='won'?'Winner':'Nominated; another performer won'}`).join('\n')+(awards[0].attendance==='attending'?' You attended the ceremony.':' You receive the news away from the ceremony.'),[choice('ack','Continue')],{},`results-${key}`);
 }
 for(const c of s.commitments.filter(c=>c.personId===s.activeId&&c.status==='scheduled'&&date>=c.end)){c.status='completed';if(c.kind==='wedding'){const p=s.people.find(p=>p.id===c.guestId);if(p&&bond(s,p).dating){bond(s,p).status='married';p.socialLife.status='married';remember(s,p,'Your wedding','You celebrate your marriage together.')}}}
}
function relationshipEvents(s,catalogue){
 const profile=ensureOverhaul(s),date=currentDate(s);if(openLifeEvent(s)||profile.lastStory&&daysBetween(profile.lastStory,date)<28)return;
 const contacts=living(s).filter(p=>s.relationships[p.name]&&(s.relationships[p.name].friendship>=25||s.relationships[p.name].dating||p.rivalry>=35)).sort((a,b)=>(bond(s,b).dating?100:bond(s,b).friendship)-(bond(s,a).dating?100:bond(s,a).friendship)).slice(0,60);
 for(const p of contacts){
  const t=socialProfile(s,p),r=bond(s,p);
  if(!r.dating&&personAge(s,p)>=18&&daysBetween(p.socialLife.lastChange,date)>90&&rand(s)<.005){p.socialLife=p.socialLife.status==='single'?{status:'dating',partnerName:['Alex','Taylor','Jamie'][fingerprint(p.name)%3]+' Vale',lastChange:date}:{status:'single',partnerName:null,lastChange:date};remember(s,p,'Their life moves forward',p.socialLife.status==='single'?'They mention that their relationship has ended.':'They mention someone new they have been seeing.')}
  if(r.dating){
   r.trust=limit(r.trust-(r.tension>60?1:0));if(r.public&&s.fame>=50&&personality(p).privacy)r.tension=limit(r.tension+.5);r.affection=limit(r.affection+(r.lastQuality&&daysBetween(r.lastQuality,date)<14?1:-.3));
   if(r.tension>75&&rand(s)<.04){r.dating=false;r.status='ex';r.commitment=0;r.cohabiting=false;p.socialLife={status:'single',partnerName:null,lastChange:date};remember(s,p,'They end the relationship','They no longer feel that your needs and priorities can fit together. Your shared history remains.');continue}
  }
  if(rand(s)>.025)continue;
  let event;
  if(p.rivalry>=35)event=queueEvent(s,'rivalry','A rivalry reaches the press',`${p.name} makes a pointed remark about your working relationship. How do you respond?`,[choice('private','Speak to them privately'),choice('public','Answer publicly'),choice('ignore','Let the work speak')],{personId:p.id});
  else if(r.dating&&r.status==='dating'&&r.commitment>=30&&daysBetween(r.datingSince||date,date)>=60&&t.intention!=='casual'){event=queueEvent(s,'relationship','They want to talk about commitment',`${p.name} wants to know whether you would like an exclusive relationship.`,[choice('accept','Discuss exclusivity together'),choice('boundary','Explain why I need more time'),choice('decline','Keep things casual')],{personId:p.id,action:'commit'})}
  else if(r.dating){const strained=r.tension>=35;event=queueEvent(s,'relationship',strained?'A conversation you cannot keep postponing':'They make time for you',strained?`${p.name} wants to talk about ${r.public&&s.fame>=50?'public attention and how to protect your privacy':r.cohabiting?'sharing responsibilities at home':'time apart and different expectations'}.`:`${p.name} suggests ${t.independence>60?'an evening without work or public attention':'spending a quiet evening together'}.`,[choice('listen','Listen and make time'),choice('boundary','Explain my boundaries'),choice('decline','Put work first this time')],{personId:p.id})}
  else if(romanceAllowed(s,p)&&p.socialLife.status==='single'&&r.chemistry>=25&&r.friendship>=35){event=queueEvent(s,'relationship','They make the first move',`${p.name} asks whether you would like to try a date. Friendship does not obligate either of you to romance.`,[choice('accept','Accept the invitation'),choice('boundary','Keep getting to know each other'),choice('decline','Prefer to stay friends')],{personId:p.id,action:'date'})}
  else event=queueEvent(s,'friendship','A friend reaches out',`${p.name} ${t.ambition>65?'is unsure about a career decision':'is having a difficult time and could use company'}.`,[choice('help','Make time to support them'),choice('honest','Listen, but be honest about my availability'),choice('decline','Keep my distance')],{personId:p.id});
  if(event){profile.lastStory=date;return}
 }
}
function rumourTick(s){
 const profile=ensureOverhaul(s),date=currentDate(s);if(openLifeEvent(s)||s.fame<40||profile.lastRumour&&daysBetween(profile.lastRumour,date)<90)return;
 const sight=s.publicSightings.filter(o=>o.from===s.activeId&&o.type!=='private'&&daysBetween(o.date,date)<45).at(-1),p=sight&&s.people.find(p=>p.id===sight.with);if(!p||!p.alive||(p.fame||0)<30)return;
 const r=bond(s,p);if(r.public||r.friendship<55&&!r.dating||rand(s)>.12)return;
 profile.lastRumour=date;queueEvent(s,'rumour',s.year>=2010?'Speculation is spreading online':'An entertainment column links your names',`After a public appearance with ${p.name}, people are speculating about your connection. ${r.dating?'Your relationship is still private.':'You are friends; the rumour does not make you a couple.'}`,[choice('ignore','Ignore the speculation'),choice('friendship','Acknowledge our friendship'),choice('deny','Deny a romance'),...(r.dating?[choice('confirm','Confirm together, if we agree'),choice('boundaries','Discuss privacy with my partner')]:[])],{personId:p.id});
}
function publicityTick(s,catalogue){
 const profile=ensureOverhaul(s),date=currentDate(s);if(openLifeEvent(s)||s.fame<35||profile.lastPublicity&&daysBetween(profile.lastPublicity,date)<28)return;
 for(const c of s.filmography.filter(c=>c.personId===s.activeId&&c.status==='post-production'&&!c.promotionInvited)){
  const p=production(s,catalogue,c.projectId);if(!p||daysBetween(date,projectSchedule(p).releaseDate)>60||roleAssessment(s,p,c.roleIndex||0).prominence<40||projectReach(p)<55)continue;
  const host=s.year>=2014?'The Tonight Show with Jimmy Fallon':s.year>=2003?'Jimmy Kimmel Live!':s.year>=1992?'The Tonight Show with Jay Leno':s.year>=1962?'The Tonight Show with Johnny Carson':'a television or radio interview';
  const appearanceDate=plusDays(date,7);if(calendarReason(s,appearanceDate,plusDays(appearanceDate,1)))continue;
  c.promotionInvited=true;profile.lastPublicity=date;queueEvent(s,'publicity',`An invitation to ${host}`,`The show would like you to discuss ${p.title} before its release. The appearance is scheduled for ${appearanceDate}.`,[choice('attend','Accept the appearance'),choice('decline','Decline and keep the time')],{projectId:p.id,appearanceDate});return;
 }
}
function directOffers(s,catalogue){
 const profile=ensureOverhaul(s),date=currentDate(s);if(s.fame<50||pendingOffers(s).length>=4||profile.lastDirectOffer&&daysBetween(profile.lastDirectOffer,date)<28)return;
 profile.lastDirectOffer=date;
 const known=Object.values(profile.identities).filter(i=>i.strength>=50);
 const rejected=s.roleOffers.filter(o=>o.personId===s.activeId&&o.status==='declined'&&o.declinedOn&&daysBetween(o.declinedOn,date)>=14&&(o.reapproaches||0)<3&&known.some(i=>i.character===o.character||i.genre===production(s,catalogue,o.projectId)?.genre)).at(-1);
 if(rejected){const p=production(s,catalogue,rejected.projectId);if(p&&projectPhase(s,p)==='Casting'&&!castingReason(s,p,rejected.index)&&!offerConflict(s,catalogue,p)&&!s.casts[`${p.id}:${rejected.index}`]){const offer=makeOffer(s,p,rejected.index,{source:'studio',fee:Math.round(rejected.fee*1.4)});offer.reapproaches=(rejected.reapproaches||0)+1;rejected.reapproaches=3;queueEvent(s,'casting','A tempting familiar offer',`${p.title} comes back with a higher fee for ${offer.character}. You can take the familiar work or keep room for a different direction.`,[choice('ack','Review the offer')],{offerId:offer.id},`approach-${offer.id}`);return}}
 const ceiling=Math.min(100,40+(s.fame-50)*1.4+careerProfile(s).reputation*.25);
 const pool=available(s,catalogue).filter(o=>o.fit>50&&roleAssessment(s,o.project,o.index).reach<=ceiling).sort((a,b)=>{const x=roleAssessment(s,a.project,a.index),y=roleAssessment(s,b.project,b.index);return y.reach*y.prominence-x.reach*x.prominence});
 const candidate=pool[Math.floor(rand(s)*Math.min(8,pool.length))];if(!candidate)return;
 const offer=makeOffer(s,candidate.project,candidate.index,{source:'studio'});queueEvent(s,'casting','A production approaches you directly',`${offer.title} offers you ${offer.character}. You can review the fee and dates before deciding.`,[choice('ack','Review the offer')],{offerId:offer.id},`approach-${offer.id}`);
}
function recastTick(s,catalogue){
 const profile=ensureOverhaul(s),date=currentDate(s);if(openLifeEvent(s)||profile.lastRecast&&daysBetween(profile.lastRecast,date)<180||rand(s)>.015)return;
 const candidates=all(s,catalogue).filter(p=>projectPhase(s,p)==='Casting').flatMap(p=>Object.keys(p.incumbents||{}).map(i=>({p,i:Number(i)}))).filter(({p,i})=>roleFit(s,p,p.roles[i])>50&&!offerConflict(s,catalogue,p));if(!candidates.length)return;
 const {p,i}=candidates[Math.floor(rand(s)*candidates.length)];profile.lastRecast=date;queueEvent(s,'recast','An established role is being recast',`In this alternate timeline, ${p.title} is considering a replacement for ${p.roles[i].character}. This is an explicit vacancy, not a normal returning-role audition.`,[choice('pursue','Ask to be considered'),choice('pass','Leave it alone')],{projectId:p.id,index:i,title:p.title,expiresOn:projectSchedule(p).castingEnd});
}
export function overhaulTick(s,catalogue){
 if(s.complete)return;ensureOverhaul(s);syncCalendar(s,all(s,catalogue),projectSchedule);applicationTick(s,catalogue);economyTick(s);ceremoniesTick(s);
 for(const c of s.filmography.filter(c=>c.personId===s.activeId&&c.outcome&&!c.receptionReported&&!c.overhaulLegacy)){
  const p=production(s,catalogue,c.projectId);if(!p)continue;c.receptionReported=true;
  queueEvent(s,'release',`Release report: ${c.title}`,`Audience ${c.outcome.audience}/100 · critics ${c.outcome.critics}/100 · commercial result: ${c.outcome.result}. Your performance: ${c.outcome.performance}/100. Fame +${c.outcome.fameGain}.`,[choice('ack','Continue')],{projectId:p.id},`release-${p.id}:${s.activeId}`);nomination(s,c,p);
  for(const [i,r] of p.roles.entries()){const co=s.people.find(a=>a.name===castFor(s,p,i));if(co&&co.id!==s.activeId)co.fame=Math.max(co.fame||0,projectReach(p)*roleAssessment(s,p,i).prominence/150)}
 }
 if(!openLifeEvent(s)){
  const e=s.productionEvents.find(e=>e.personId===s.activeId&&e.status==='open'&&!e.queued);if(e){e.queued=true;const theme=workThemes[fingerprint(e.id)%workThemes.length];e.title=theme[0];e.body=theme[1];queueEvent(s,'work',e.title,e.body,[choice('cooperate','Put extra effort into the work'),choice('pushback','Discuss a different approach'),choice('rest','Protect my energy')],{eventId:e.id,projectId:e.projectId})}
 }
 relationshipEvents(s,catalogue);rumourTick(s);publicityTick(s,catalogue);directOffers(s,catalogue);recastTick(s,catalogue);
 s.publicSightings=s.publicSightings.filter(e=>daysBetween(e.date,currentDate(s))<120).slice(-80);s.commitments=s.commitments.filter(c=>c.status==='scheduled'||daysBetween(c.end,currentDate(s))<90);
}
export function buyAsset(s,id){const a=assets.find(a=>a.id===id);if(!a||personAge(s,active(s))<a.minAge||s.year<(a.minYear||1960))throw Error('This purchase is unavailable.');const price=Math.round(a.price*eraValue(s.year));if(s.money<price)throw Error('You do not have enough money.');if(s.possessions.some(p=>p.id===id&&p.ownerId===s.activeId))throw Error('You already own this asset.');s.money-=price;s.possessions.push({id:a.id,name:a.name,year:s.year,ownerId:s.activeId,paid:price});feed(s,'A purchase',`${a.name}: $${price.toLocaleString()}. Its upkeep is included in your living costs.`)}
export function sellAsset(s,id){const index=s.possessions.findIndex(p=>p.id===id&&p.ownerId===s.activeId);if(index<0)throw Error('You do not own this asset.');const owned=s.possessions[index],a=assets.find(a=>a.id===id);const value=Math.round((owned.paid||a?.price*eraValue(owned.year)||0)*(a?.kind==='home'?Math.min(1.8,1+Math.max(0,s.year-owned.year)*.025):Math.max(.2,.8-Math.max(0,s.year-owned.year)*.04)));s.money+=value;s.possessions.splice(index,1);feed(s,'An asset sold',`${owned.name}: $${value.toLocaleString()}. Its ongoing costs stop.`)}
