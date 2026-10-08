// v1.2 career choices. Production dates and story outcomes are game simulations.
import {active,currentDate,clamp,rand,pick,available,audition,bookRole,roleFit,projectSchedule,useActivity,castFor,ensurePerson,genderCompatible} from './engine.js?v=15';
import {offeredFee,reception as releaseReception,calendarReason,castingReason,typecastPressure} from './game-rules.js?v=15';

const datePlus=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const key=(s,p,i)=>`${s.activeId}:${p.id}:${i}`;
const allProjects=(s,c)=>[...c,...s.projects];
const lookup=(s,c,id)=>allProjects(s,c).find(p=>p.id===id);
const intersects=(a,b)=>a.filmingStart<b.filmingEnd&&b.filmingStart<a.filmingEnd;
const log=(s,title,body)=>s.timeline.unshift({year:s.year,month:s.month,date:currentDate(s),title,body});

export function ensureCareer(s){
 if(!s.careerVersion){for(const credit of s.filmography)if(credit.status==='released')credit.legacyOutcome=true;s.careerVersion=2}
 s.careerProfiles??={};s.careerProfiles[s.activeId]??={reputation:60,agent:null};
 s.preparations??={};s.careerAuditions??=[];s.roleOffers??=[];s.contracts??=[];s.productionEvents??=[];s.productionOutcomes??={};s.worldChanges??=[];s.customCollections??={};
 s.tvCareers??=[];s.filmCareers??=[];s.continuityDecisions??={};s.showChanges??={};s.continuityChanges??=[];s.continuityRequests??=[];
 return s
}
export const careerProfile=s=>(ensureCareer(s),s.careerProfiles[s.activeId]);
export function attachFranchises(projects,data){
 for(const p of projects){p.collectionId=data.projectCollections?.[p.id]||p.collectionId;p.baselineRating=data.ratings?.[p.id]??p.baselineRating}
 return projects
}
export function pendingAuditions(s){return (s.careerAuditions||[]).filter(a=>a.personId===s.activeId&&a.status==='callback')}
export function pendingOffers(s){return (s.roleOffers||[]).filter(o=>o.personId===s.activeId&&o.status==='offered')}
export function agentChoices(s){
 const profile=careerProfile(s);
 return [{level:1,name:'Independent agent',commission:.10,description:'Helps find roles and improve audition prospects.',eligible:profile.reputation>=25},
  {level:2,name:'Established agency',commission:.12,description:'Better fees and more direct approaches.',eligible:profile.reputation>=40&&(s.fame>=15||s.respect>=15)},
  {level:3,name:'Major agency',commission:.15,description:'The strongest access and negotiating support.',eligible:profile.reputation>=50&&s.fame>=40&&s.respect>=25}]
}
export function hireAgent(s,level){
 const profile=careerProfile(s);
 if(level===0){profile.agent=null;s.representation=0;log(s,'Changing representation','You decide to represent yourself. Existing agreed commissions still apply.');return}
 const option=agentChoices(s).find(a=>a.level===level);
 if(!option?.eligible)throw Error('That agency is not ready to represent you yet.');
 profile.agent={level,name:option.name,commission:option.commission};s.representation=level;
 log(s,'New representation',`${option.name} now represents you. Commission is taken from new agreed acting fees, not your existing money.`)
}
export function preparation(s,p,index){return s.preparations?.[key(s,p,index)]?.score||0}
export function prepareAudition(s,catalogue,p,index,kind='script'){
 ensureCareer(s);
 if(!available(s,catalogue,{includePending:true}).some(o=>o.project.id===p.id&&o.index===index))throw Error('That role is no longer casting or does not fit your schedule.');
 if(pendingOffers(s).some(o=>o.projectId===p.id&&o.index===index))throw Error('You already have this offer.');
 const prior=s.preparations[key(s,p,index)]||{score:0,sessions:0};
 if(prior.score>=60)throw Error('You are fully prepared for this role.');
 if(!['script','coach'].includes(kind))throw Error('Unknown preparation.');
 const cost=kind==='coach'?(s.year<1980?50:s.year<2000?200:500):0;
 if(s.money<cost)throw Error(`Coaching costs $${cost}. Reading the script is free.`);
 useActivity(s);s.money-=cost;
 s.preparations[key(s,p,index)]={score:Math.min(60,prior.score+(kind==='coach'?25:15)),sessions:prior.sessions+1,date:currentDate(s)};
 log(s,'Preparing for a role',`${kind==='coach'?'A coaching session':'Reading and rehearsing the script'} helps you prepare for ${p.title}: ${p.roles[index].character}.`)
}
const genreSkill=(s,p)=>/comedy/i.test(p.genre||'')?s.skills.comedy:s.skills.drama;
const baseFee=p=>p.year<1980?1200:p.year<2000?8500:28000;
export function makeOffer(s,p,index,{source='callback',forced=false,contractId=null,tvCareerId=null,fee=null,expiresOn=null}={}){
 const existing=pendingOffers(s).find(o=>o.projectId===p.id&&o.index===index);if(existing)return existing;
 const profile=careerProfile(s),agent=profile.agent;
 const offer={id:`offer-${s.nextId++}`,personId:s.activeId,projectId:p.id,year:p.year,title:p.title,index,character:p.roles[index].character,status:'offered',source,forced,contractId,
  fee:fee??(s.overhaulVersion?offeredFee(s,p,index):Math.round(baseFee(p)*(1+s.fame/100+(agent?.level||0)*.12))),agentCommission:agent?.commission||0,
  expiresOn:expiresOn||[datePlus(currentDate(s),14),projectSchedule(p).castingEnd].sort()[0],negotiated:false,tvCareerId};
 s.roleOffers.push(offer);log(s,source==='contract'?'Your franchise return':'A role offer',`${p.title} wants you as ${offer.character}. Review the dates and terms before accepting.`);return offer
}
export function startAudition(s,catalogue,p,index,{forceWin=false}={}){
 ensureCareer(s);const role=p.roles[index];
 if(!available(s,catalogue).some(o=>o.project.id===p.id&&o.index===index))throw Error('This audition is unavailable or conflicts with another commitment.');
 if(forceWin)return {stage:'offer',offer:makeOffer(s,p,index,{source:'cheat',forced:true})};
 const profile=careerProfile(s),score=roleFit(s,p,role)*.35+s.skills.acting*.20+genreSkill(s,p)*.10+profile.reputation*.15+preparation(s,p,index)*.35+(profile.agent?.level||0)*4-(s.overhaulVersion?typecastPressure(s,p,index):0);
 const chance=clamp(score/100,.08,.92);
 if(rand(s)>chance){s.choices.push(`${p.id}:${index}`);s.casts[`${p.id}:${index}`]=role.actor;log(s,`Audition: ${p.title}`,`You were not invited to the callback for ${role.character}. Another production may be a better opportunity.`);return {stage:'rejected'}}
 if(s.overhaulVersion&&Number(p.voteCount||0)<250&&Number(p.popularity||0)<15)return {stage:'offer',offer:makeOffer(s,p,index,{source:'audition'})};
 const end=projectSchedule(p).castingEnd,callback={id:`callback-${s.nextId++}`,personId:s.activeId,projectId:p.id,year:p.year,title:p.title,index,character:role.character,status:'callback',readyOn:[datePlus(currentDate(s),7),datePlus(end,-1)].sort()[0],expiresOn:end};
 s.careerAuditions.push(callback);log(s,'A callback invitation',`${p.title} invites you back for ${role.character}. The final casting decision is still ahead.`);return {stage:'callback',callback}
}
export function attendCallback(s,catalogue,id,{forceWin=false}={}){
 ensureCareer(s);const callback=pendingAuditions(s).find(a=>a.id===id),p=callback&&lookup(s,catalogue,callback.projectId);
 if(!callback||!p)throw Error('This callback is unavailable.');
 if(!forceWin&&currentDate(s)<callback.readyOn)throw Error('The callback is not ready yet. You can prepare in the meantime.');
 if(currentDate(s)>=callback.expiresOn)throw Error('This callback has closed.');
 const result=audition(s,catalogue,p,p.roles[callback.index],callback.index,{forceWin,deferBooking:true,includePending:true});
 callback.status=result.win?'offered':'rejected';
 if(result.win)return {stage:'offer',offer:makeOffer(s,p,callback.index,{forced:forceWin})};
 return {stage:'rejected',result}
}
export function searchAgentOffers(s,catalogue){
 const profile=careerProfile(s);if(!profile.agent)throw Error('Hire an agent first.');
 if(profile.lastSearch===currentDate(s))throw Error('Your agent has already searched this week.');
 profile.lastSearch=currentDate(s);
 if(s.overhaulVersion&&s.fame<50){log(s,'Your agent checks casting','Direct offers unlock at 50 fame. Browse World and apply for open roles now.');return 0}
 const candidates=available(s,catalogue).filter(o=>o.fit>=50).slice(0,30),chosen=[];
 while(candidates.length&&chosen.length<2){const candidate=pick(s,candidates);candidates.splice(candidates.indexOf(candidate),1);if(chosen.some(o=>o.project.id===candidate.project.id))continue;chosen.push(candidate)}
 const room=Math.max(0,4-pendingOffers(s).length);let count=0;
 for(const o of chosen.slice(0,room)){
  if(s.skills.acting>=30||s.fame>=10||profile.agent.level>=2){makeOffer(s,o.project,o.index,{source:'agent'});count++}
  else{const outcome=startAudition(s,catalogue,o.project,o.index);if(outcome.stage==='callback')count++}
 }
 log(s,'Your agent checks in',count?`${count} new ${s.skills.acting>=30||s.fame>=10||profile.agent.level>=2?'offers':'callbacks'} to consider. Their filming dates may compete with each other.`:'No new suitable approaches this week.');return count
}
export function negotiateOffer(s,id){
 const offer=pendingOffers(s).find(o=>o.id===id);if(!offer||offer.source==='contract')throw Error('This fee cannot be renegotiated here.');
 if(offer.negotiated)throw Error('You have already negotiated these terms.');
 offer.negotiated=true;const agent=careerProfile(s).agent;
 if(!offer.forced&&rand(s)<(agent?.level? .08:.18)){offer.status='withdrawn';log(s,'Negotiations fall through',`${offer.title} withdraws the offer. Your agent looks ahead to other roles.`);return false}
 const increase=.06+(agent?.level||0)*.03+Math.min(.12,s.respect/500);offer.fee=Math.round(offer.fee*(1+increase));
 log(s,'Improved terms',`${offer.title} agrees to a higher fee. You still need to accept the role.`);return true
}
export function characterKey(name){return String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\((?:voice|uncredited)\)/gi,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function customPlan(s,p,index){
 if(!p.generated||p.kind!=='Film')return [];
 return [2,4].map((gap,i)=>{const year=p.year+gap,role={...p.roles[index]};if(role.characterAge!=null)role.characterAge+=gap;role.ageMin+=gap;role.ageMax+=gap;
  const project={id:`sequel-${p.id}-${i+1}`,title:`${p.title} ${i===0?'II':'III'}`,year,releaseDate:`${year}-09-15`,kind:'Film',genre:p.genre,director:p.director,roles:p.roles.map((r,j)=>j===index?role:{...r}),generated:true,franchiseContinuation:true,collectionId:`custom-${p.id}`};
  return {project,index,character:role.character}
 })
}
export function franchisePlan(s,p,index,data){
 const cid=p.collectionId||data.projectCollections?.[p.id],collection=data.collections?.[cid]||s.customCollections?.[cid];
 if(!collection)return customPlan(s,p,index);
 const wanted=characterKey(p.roles[index]?.character),end=projectSchedule(p).filmingEnd;
 // A repeated unnamed extra is not evidence that the same character returns.
 if(!wanted||/^(?:(?:a|an|the) )?(?:man|woman|boy|girl|child|guard|henchman|soldier|reporter|doctor|nurse|cop|policeman|police officer|dancer|singer|extra|voice|himself|herself|self|uncredited)(?: \d+)?$/.test(wanted))return [];
 // Long-gap revivals and same-title remakes belong to the later continuity update.
 return collection.parts.filter(part=>part.id!==p.id&&part.year<=p.year+10&&characterKey(part.title)!==characterKey(p.title)&&(part.releaseDate||`${part.year}-07-01`)>(p.releaseDate||`${p.year}-07-01`)).flatMap(part=>{
  const matches=part.roles.filter(r=>characterKey(r.character)===wanted);
  if(matches.length!==1||!genderCompatible(active(s).gender,matches[0].gender)||projectSchedule(part).filmingStart<end)return [];
  return [{project:part,index:matches[0].index??part.roles.indexOf(matches[0]),character:matches[0].character}]
 }).slice(0,2)
}
export function reservations(s){return (s.contracts||[]).filter(c=>c.personId===s.activeId&&c.status==='active').flatMap(c=>c.entries.filter(e=>e.status==='reserved'||e.status==='offered').map(e=>({contractId:c.id,entry:e,schedule:projectSchedule(e.project)})))}
export function offerConflict(s,catalogue,p,exceptContract=null){
 const t=projectSchedule(p),ids=new Set(s.filmography.filter(f=>f.personId===s.activeId&&f.status!=='withdrawn').map(f=>f.projectId));
 return (s.overhaulVersion&&s.commitments?.some(c=>c.personId===s.activeId&&c.status==='scheduled'&&t.filmingStart<c.end&&c.start<t.filmingEnd))||allProjects(s,catalogue).some(booked=>ids.has(booked.id)&&booked.id!==p.id&&intersects(t,projectSchedule(booked)))||reservations(s).some(r=>r.contractId!==exceptContract&&r.entry.project.id!==p.id&&intersects(t,r.schedule))||s.tvCareers?.some(c=>c.personId===s.activeId&&c.status==='active'&&c.next&&c.next.id!==p.id&&intersects(t,projectSchedule(c.next)))
}
export function acceptCareerOffer(s,catalogue,id,data,{multiFilm=false}={}){
 ensureCareer(s);const offer=pendingOffers(s).find(o=>o.id===id),p=offer&&lookup(s,catalogue,offer.projectId);
 if(!offer||!p)throw Error('This offer is unavailable.');
 if(currentDate(s)>=offer.expiresOn||currentDate(s)>=projectSchedule(p).filmingStart)throw Error('This offer has expired.');
 if(offerConflict(s,catalogue,p,offer.contractId))throw Error('This shoot conflicts with an accepted role or binding franchise commitment.');
 const role=p.roles[offer.index];if(!role||s.casts[`${p.id}:${offer.index}`]&&s.casts[`${p.id}:${offer.index}`]!==active(s).name)throw Error('The part has already been cast.');
 const plan=multiFilm?franchisePlan(s,p,offer.index,data):[];
 if(multiFilm&&!plan.length)throw Error('No matching returning character is mapped for this role yet.');
 if(plan.some((entry,i)=>offerConflict(s,catalogue,entry.project)||plan.slice(0,i).some(other=>intersects(projectSchedule(entry.project),projectSchedule(other.project)))))throw Error('Those future shoots conflict with existing commitments. You can accept this film alone.');
 let contract=null;
 if(multiFilm){
  const cid=p.collectionId||data.projectCollections?.[p.id]||`custom-${p.id}`;
  contract={id:`contract-${s.nextId++}`,personId:s.activeId,collectionId:cid,name:data.collections?.[cid]?.name||`${p.title} series`,character:role.character,status:'active',signedOn:currentDate(s),originProjectId:p.id,entries:plan.map((entry,i)=>({project:{...entry.project,roles:undefined},index:entry.index,character:entry.character,fee:Math.round(offer.fee*(1.2+i*.2)),status:'reserved',troubled:rand(s)<.25}))};
  // Generated continuations exist only after the player signs, never on preview.
  if(p.generated&&!data.collections?.[cid]){p.collectionId=cid;for(const entry of plan){if(!s.projects.some(x=>x.id===entry.project.id))s.projects.push(entry.project);if(!s.usedTitles.includes(entry.project.title))s.usedTitles.push(entry.project.title)}s.customCollections[cid]={id:cid,name:contract.name,parts:[p,...plan.map(e=>e.project)]}}
  s.contracts.push(contract);log(s,'A multi-film commitment',`You sign for ${p.title} and ${plan.length} returning appearances as ${role.character}. Future shoots are reserved; refusing a required return ends the deal.`)
 }
 const credit=bookRole(s,catalogue,p,role,offer.index,{returning:Boolean(offer.tvCareerId||offer.contractId||offer.source==='alternate-return')});
 credit.fee=Math.round(offer.fee*(multiFilm?1.10:1));credit.agentCommission=offer.agentCommission;credit.contractId=offer.contractId||contract?.id||null;credit.performance={effort:0,teamwork:0,pressure:0};
 if(p.generated&&p.kind==='TV series'&&!p.seriesId){p.seriesId=p.id;p.seriesTitle=p.title;p.seasonNumber=1}
 if(p.seriesId){
  credit.seriesId=p.seriesId;credit.seasonNumber=p.seasonNumber;
  let series=s.tvCareers.find(c=>c.personId===s.activeId&&c.seriesId===p.seriesId&&c.characterKey===characterKey(role.character)&&c.status==='active');
  if(!series){series={id:`tv-career-${s.nextId++}`,personId:s.activeId,seriesId:p.seriesId,title:p.seriesTitle||p.title,character:role.character,characterKey:characterKey(role.character),actorId:role.personId,status:'active',fans:0,handled:[]};s.tvCareers.push(series)}
  series.lastProjectId=p.id;series.lastSeason=p.seasonNumber;series.lastFee=credit.fee;series.next=null;credit.tvCareerId=series.id;
 }
 if(p.kind==='Film'&&p.collectionId&&!s.filmCareers.some(c=>c.personId===s.activeId&&c.lastProjectId===p.id))s.filmCareers.push({id:`film-career-${s.nextId++}`,personId:s.activeId,collectionId:p.collectionId,character:role.character,characterKey:characterKey(role.character),lastProjectId:p.id,handled:false});
 offer.status='accepted';
 if(s.overhaulVersion)for(const a of s.applications||[])if(a.personId===s.activeId&&a.projectId===p.id&&['watching','considering','invited','callback','offered'].includes(a.status))a.status=a.index===offer.index?'accepted':'withdrawn';
 if(offer.contractId){const c=s.contracts.find(c=>c.id===offer.contractId),entry=c?.entries.find(e=>e.project.id===p.id);if(entry){entry.status='booked';credit.creativeRisk=entry.troubled}}
 for(const other of pendingOffers(s))if(other.projectId===p.id){other.status='superseded'}
 log(s,'Role accepted',`${p.title}: you will play ${role.character}. ${s.overhaulVersion?p.kind==='TV series'?'Season pay arrives as filming progresses.':'Payments arrive at the start, midpoint and wrap.':'Payment is due at wrap.'} Agreed agent commission is deducted.`);return {credit,contract}
}
export function terminateContract(s,id,reason='creative concerns'){
 ensureCareer(s);const contract=s.contracts.find(c=>c.id===id&&c.personId===s.activeId&&c.status==='active');if(!contract)throw Error('This contract is not active.');
 contract.status='terminated';contract.endedOn=currentDate(s);contract.reason=reason;
 for(const entry of contract.entries){
  if(entry.status==='completed')continue;
  const credit=s.filmography.find(f=>f.personId===s.activeId&&f.projectId===entry.project.id&&f.contractId===id);
  if(credit?.status==='booked'&&currentDate(s)<projectSchedule(entry.project).filmingStart){credit.status='withdrawn';delete s.casts[`${entry.project.id}:${entry.index}`]}
  entry.status='released-from-deal';
 }
 for(const offer of s.roleOffers)if(offer.contractId===id&&offer.status==='offered')offer.status='declined';
 const profile=careerProfile(s),penalty=contract.unfairDemands?7:18;profile.reputation=clamp(profile.reputation-penalty,0,100);s.respect=clamp(s.respect-(contract.unfairDemands?2:6),0,100);
 log(s,'A franchise contract ends',`You leave ${contract.name} over ${reason}. The studio can recast your character. Your professional reputation is now ${profile.reputation}/100.`);return contract
}
export function declineCareerOffer(s,id){
 const offer=pendingOffers(s).find(o=>o.id===id);if(!offer)throw Error('This offer is unavailable.');
 if(offer.tvCareerId)return leaveSeries(s,offer.tvCareerId);
 if(offer.contractId)return terminateContract(s,offer.contractId,'refusing the next film');
 offer.status='declined';if(!s.choices.includes(`${offer.projectId}:${offer.index}`))s.choices.push(`${offer.projectId}:${offer.index}`);
 offer.declinedOn=currentDate(s);if(s.overhaulVersion){const life=s.lifeProfiles?.[s.activeId],top=Object.values(life?.identities||{}).find(i=>i.character===offer.character);if(top)top.strength=Math.max(0,top.strength-2)}
 log(s,'Choosing a different path',`You decline ${offer.title}. No franchise obligation was signed.`)
}
export function leaveSeries(s,id){
 ensureCareer(s);const c=s.tvCareers.find(c=>c.id===id&&c.personId===s.activeId&&c.status==='active');if(!c)throw Error('This series role is no longer active.');
 c.status='left';c.leftOn=currentDate(s);c.next=null;
 for(const o of s.roleOffers)if(o.tvCareerId===id&&o.status==='offered')o.status='declined';
 log(s,'Leaving a series',`You leave ${c.title} as ${c.character}. The writers and studio will have to decide how the show continues without you.`);return c
}
export function onSetAction(s,catalogue,projectId,kind){
 ensureCareer(s);const p=lookup(s,catalogue,projectId),credit=s.filmography.find(f=>f.personId===s.activeId&&f.projectId===projectId&&f.status==='filming');
 if(!p||!credit)throw Error('You are not filming this production.');
 if(!['rehearse','teamwork','rest'].includes(kind))throw Error('Unknown on-set activity.');
 useActivity(s);credit.performance??={effort:0,teamwork:0,pressure:0};
 if(kind==='rehearse'){credit.performance.effort=clamp(credit.performance.effort+6,0,40);s.health=clamp(s.health-2,0,100)}
 if(kind==='rest')s.health=clamp(s.health+6,0,100);
 if(kind==='teamwork'){
  credit.performance.teamwork=clamp(credit.performance.teamwork+5,0,30);
  const others=p.roles.map((r,i)=>({r,name:castFor(s,p,i)})).filter(x=>x.name!==active(s).name).slice(0,12);
  for(const co of others){ensurePerson(s,co.name,'Actor',co.r.birthYear,co.r.gender);const rel=s.relationships[co.name]??={friendship:0,respect:0,chemistry:0};rel.friendship=clamp(rel.friendship+3,-100,100);rel.respect=clamp(rel.respect+3,0,100)}
 }
 log(s,`On set: ${p.title}`,{rehearse:'You spend extra time refining your scenes.',teamwork:'You help your castmates through a difficult day. The working relationships improve.',rest:'You protect your energy for the next day of filming.'}[kind])
}
export function resolveProductionEvent(s,id,choice){
 ensureCareer(s);const event=s.productionEvents.find(e=>e.id===id&&e.personId===s.activeId&&e.status==='open');if(!event)throw Error('This on-set moment has passed.');
 if(!['cooperate','pushback','rest'].includes(choice))throw Error('Unknown response.');
 const credit=s.filmography.find(f=>f.personId===s.activeId&&f.projectId===event.projectId&&f.status==='filming');if(!credit)throw Error('This production is no longer filming.');
 event.status='resolved';credit.performance??={effort:0,teamwork:0,pressure:0};
 if(choice==='cooperate'){s.health=clamp(s.health-8,0,100);credit.performance.effort=clamp(credit.performance.effort+5,0,40);credit.performance.pressure+=3;log(s,'A difficult filming day','You agree to the extra demands. The work advances, but the pressure takes a toll.')}
 else if(choice==='pushback'){s.health=clamp(s.health+2,0,100);credit.performance.teamwork=clamp(credit.performance.teamwork+4,0,30);log(s,'Setting a boundary','You push back on the unreasonable request. Some colleagues support you; the studio remembers the disagreement.')}
 else{s.health=clamp(s.health+6,0,100);log(s,'Taking care of yourself','You take time to recover instead of pushing through the pressure.')}
 const contract=s.contracts.find(c=>c.id===credit.contractId&&c.status==='active');if(contract)contract.unfairDemands=true
}
function reviewRelease(s,credit,p){
 if(s.overhaulVersion&&p){const outcome=releaseReception(s,credit,p);credit.outcome=outcome;s.productionOutcomes[credit.projectId]=outcome;log(s,`The verdict: ${credit.title}`,`${outcome.result} · audience ${outcome.audience}/100 · critics ${outcome.critics}/100 · your performance ${outcome.performance}/100. Fame +${outcome.fameGain}.`);return}
 const effort=credit.performance?.effort||0,teamwork=credit.performance?.teamwork||0;
 const rating=Number(p?.baselineRating)||6,shock=rand(s)<.15?-28:0,skills=credit.skillsAtWrap||s.skills;
 const collaborators=(p?.roles||[]).map((r,i)=>castFor(s,p,i)).filter(name=>name!==active(s).name),workingRespect=collaborators.length?collaborators.reduce((n,name)=>n+(s.relationships[name]?.respect||0),0)/collaborators.length:0;
 const performance=clamp(Math.round(skills.acting*.55+(/comedy/i.test(p?.genre||'')?skills.comedy:skills.drama)*.20+effort*.45+teamwork*.25+workingRespect*.08+rand(s)*20),0,100);
 const reception=clamp(Math.round(rating*5+performance*.45+rand(s)*30+shock-(credit.creativeRisk?16:0)),0,100),result=reception>=72?'hit':reception<43?'flop':'mixed reception';
 const outcome={personId:s.activeId,projectId:credit.projectId,title:credit.title,performance,reception,result,date:currentDate(s),fictional:true};
 credit.outcome=outcome;s.productionOutcomes[credit.projectId]=outcome;
 const profile=careerProfile(s);profile.reputation=clamp(profile.reputation+(performance>=65?3:performance<30?-2:1),0,100);
 s.fame=clamp(s.fame+(result==='hit'?4:result==='flop'?-2:0),0,100);
 log(s,`The verdict: ${credit.title}`,`In this timeline, the production receives ${result==='mixed reception'?'a mixed reception':`a ${result}`}. Your performance earns ${performance}/100. Future offers and franchise decisions take notice.`)
}
export function careerTick(s,catalogue,data){
 ensureCareer(s);const date=currentDate(s);if(s.complete)return;
 for(const callback of pendingAuditions(s))if(date>=callback.expiresOn){callback.status='expired';log(s,'A callback closes',`You missed the callback for ${callback.title}.`)}
 for(const offer of pendingOffers(s)){
  const p=lookup(s,catalogue,offer.projectId),taken=s.casts[`${offer.projectId}:${offer.index}`];
  if(date>=offer.expiresOn||taken&&taken!==active(s).name){
   if(offer.contractId){terminateContract(s,offer.contractId,'missing a required return');continue}
   if(offer.tvCareerId){const c=s.tvCareers.find(c=>c.id===offer.tvCareerId&&c.status==='active');if(c)leaveSeries(s,c.id)}
   offer.status='expired';log(s,'An offer expires',`${offer.title} proceeds without you.`)
  }
 }
 for(const credit of s.filmography.filter(f=>f.personId===s.activeId)){
  if(credit.status==='released'&&!credit.outcome&&!credit.legacyOutcome)reviewRelease(s,credit,lookup(s,catalogue,credit.projectId));
  if(credit.status!=='filming')continue;
  const t=lookup(s,catalogue,credit.projectId);if(!t)continue;
  if(credit.lastSetEvent===date||s.productionEvents.some(e=>e.projectId===credit.projectId&&e.status==='open')||s.overhaulVersion&&(s.lifeEvents?.some(e=>e.status==='open'&&e.personId===s.activeId)||s.lastProductionDilemma&&date<datePlus(s.lastProductionDilemma,28))||rand(s)>.10)continue;
  credit.lastSetEvent=date;
  if(s.overhaulVersion)s.lastProductionDilemma=date;
  s.productionEvents.push({id:`set-${s.nextId++}`,personId:s.activeId,projectId:credit.projectId,status:'open',createdOn:date,title:`Pressure on ${credit.title}`,body:'In this fictional production, an unreasonable request for extra takes and an exhausting schedule puts you in a difficult position.'})
  const contract=s.contracts.find(c=>c.id===credit.contractId&&c.status==='active');if(contract)contract.unfairDemands=true
 }
 for(const contract of s.contracts.filter(c=>c.personId===s.activeId&&c.status==='active')){
  for(const entry of contract.entries){
   if(entry.status==='booked'){
    const credit=s.filmography.find(f=>f.personId===s.activeId&&f.projectId===entry.project.id&&f.contractId===contract.id);
    if(credit?.status==='released')entry.status='completed';continue
   }
   if(entry.status!=='reserved')continue;
   const t=projectSchedule(entry.project);if(date<t.castingStart)continue;
   if(date>=t.filmingStart){terminateContract(s,contract.id,'missing a required return');break}
   const p=lookup(s,catalogue,entry.project.id);if(!p)continue;
   makeOffer(s,p,entry.index,{source:'contract',contractId:contract.id,fee:entry.fee,expiresOn:t.filmingStart});entry.status='offered'
  }
  if(contract.status==='active'&&contract.entries.every(e=>e.status==='completed')){contract.status='completed';careerProfile(s).reputation=clamp(careerProfile(s).reputation+4,0,100);log(s,'A deal fulfilled',`You honour every agreed returning appearance in ${contract.name}. Studios value your reliability.`)}
 }
 const profile=careerProfile(s);
 if(profile.agent&&(!profile.lastAutomaticSearch||date>=datePlus(profile.lastAutomaticSearch,28))){profile.lastAutomaticSearch=date;if(pendingOffers(s).length<4&&profile.lastSearch!==date)searchAgentOffers(s,catalogue)}
 // Closed career records retain outcomes without growing the active UI forever.
 for(const event of s.productionEvents)if(event.status==='open'&&!s.filmography.some(f=>f.personId===event.personId&&f.projectId===event.projectId&&f.status==='filming'))event.status='expired';
 s.productionEvents=s.productionEvents.filter(e=>e.status==='open'||e.createdOn>=datePlus(date,-60));
 s.careerAuditions=s.careerAuditions.filter(a=>a.status==='callback'||a.expiresOn>=datePlus(date,-60));
 s.roleOffers=s.roleOffers.filter(o=>o.status==='offered'||o.expiresOn>=datePlus(date,-60));
 if(s.timeline.length>250)s.timeline=s.timeline.slice(0,250)
}
