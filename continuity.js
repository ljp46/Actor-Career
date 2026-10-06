// Credits establish appearances, not a death. Explicit story exits require a sourced override.
import {active,currentDate,projectSchedule,rand,clamp,genderCompatible} from './engine.js?v=12';
import {ensureCareer,characterKey,makeOffer,pendingOffers,leaveSeries} from './career.js?v=12';

const plus=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const log=(s,title,body)=>s.timeline.unshift({year:s.year,month:s.month,date:currentDate(s),title,body});
const projects=(s,c)=>[...new Map([...c,...s.projects].map(p=>[p.id,p])).values()];
const generic=name=>!name||/^(self|himself|herself|uncredited|voice|man|woman|guard|extra)( \d+)?$/.test(name);

export function attachSeasons(catalogue,index,seasonProjects){
 const replaced=new Set(Object.values(index.shows||{}).filter(show=>show.seasons?.length).map(show=>show.id));
 return [...catalogue.filter(p=>!replaced.has(p.id)),...seasonProjects]
}
export function characterExit(overrides,seriesId,character,season){
 return (overrides.exits||[]).find(e=>e.seriesId===seriesId&&e.afterSeason===season&&e.characters.some(n=>characterKey(n)===characterKey(character)))
}
export function migrateSeriesCareers(s,catalogue,shows){
 ensureCareer(s);
 for(const credit of s.filmography.filter(f=>f.personId===s.activeId&&f.kind==='TV series'&&f.status!=='withdrawn'&&!f.tvCareerId)){
  let p=projects(s,catalogue).find(p=>p.id===credit.projectId);
  // Legacy series-level credits are historical bookings; never pay or replay them again.
  const show=shows[credit.seriesId||credit.projectId];
  if(!p&&!show)continue;
  const sid=p?.seriesId||show?.id;if(!sid)continue;
  const season=p?.seasonNumber||show?.seasons?.find(x=>x.year===credit.year)?.number||1;
  let c=s.tvCareers.find(c=>c.personId===s.activeId&&c.seriesId===sid&&c.characterKey===characterKey(credit.role));
  if(!c){c={id:`tv-career-${s.nextId++}`,personId:s.activeId,seriesId:sid,title:p?.seriesTitle||show.title,character:credit.role,characterKey:characterKey(credit.role),status:'active',fans:0,handled:[],lastProjectId:credit.projectId,lastSeason:season,lastFee:credit.fee||28000};if(p&&!p.seriesId)c.legacyBase={...p};s.tvCareers.push(c)}
  credit.tvCareerId=c.id;credit.seriesId=sid;credit.seasonNumber=season;
 }
}
function outcomeStrength(s,credit){
 if(credit.outcome)return credit.outcome.performance;
 const skills=credit.skillsAtWrap||s.skills;
 return clamp(Math.round(skills.acting*.65+skills.drama*.2+(credit.performance?.effort||0)*.45+(credit.performance?.teamwork||0)*.3),0,100)
}
function nextSeason(show,number){return show?.seasons.find(p=>p.number>number)}
function matchingRole(season,c){
 const exact=season?.roles?.filter(r=>characterKey(r.character)===c.characterKey)||[];
 if(exact.length===1)return exact[0];
 const actor=exact.filter(r=>r.actorId===c.actorId);return actor.length===1?actor[0]:null
}
function decide(s,key,chance){
 if(!(key in s.continuityDecisions))s.continuityDecisions[key]=rand(s)<chance;
 return s.continuityDecisions[key]
}
function mark(s,body,{seriesId=null,projectId=null,type='story'}={}){
 s.continuityChanges.unshift({date:currentDate(s),seriesId,projectId,type,body});
 if(s.continuityChanges.length>200)s.continuityChanges.length=200;
 log(s,'A changing timeline',body)
}
function fictionalSeason(s,c,base,{number,year}={}){
 const previous=projectSchedule(base),release=plus(previous.releaseDate,420),y=year||Number(release.slice(0,4)),n=number||c.lastSeason+1,id=`alternate-${c.seriesId}-season-${n}`;
 if(s.projects.some(p=>p.id===id))return s.projects.find(p=>p.id===id);
 const roles=base.roles.map(r=>({...r,characterAge:r.characterAge==null?undefined:r.characterAge+y-base.year,ageMin:Math.max(4,r.ageMin+y-base.year),ageMax:r.ageMax+y-base.year}));
 const p={...base,id,year:y,releaseDate:year?`${y}-09-15`:release,finaleDate:year?`${y}-11-15`:plus(release,70),title:`${c.title} · Season ${n} (alternate timeline)`,seasonNumber:n,roles,generated:true,alternateSeason:true,franchiseContinuation:true,filmingStartDate:undefined,filmingEndDate:undefined,castingStartDate:undefined};
 s.projects.push(p);return p
}
function requestReturn(s,c,descriptor,{alternate=false}={}){
 if(currentDate(s)>=projectSchedule(descriptor).filmingStart){if(c.seriesId&&c.status==='active'){c.status='left';c.next=null;log(s,'A series moves on',`The next season of ${c.title} has already begun without you.`)}return}
 if(!s.continuityRequests.some(r=>r.careerId===c.id&&r.projectId===descriptor.id))s.continuityRequests.push({careerId:c.id,projectId:descriptor.id,seriesId:c.seriesId,year:descriptor.year,index:descriptor.index,alternate});
}
export function materializeReturns(s,catalogue){
 ensureCareer(s);
 for(const request of s.continuityRequests){
  const c=s.tvCareers.find(c=>c.id===request.careerId)||s.filmCareers.find(c=>c.id===request.careerId),p=projects(s,catalogue).find(p=>p.id===request.projectId);if(!c||!p||c.status&&c.status!=='active')continue;
  let index=request.index;
  if(request.alternate){
   const existing=p.roles.findIndex(r=>characterKey(r.character)===c.characterKey);
   if(existing>=0){
    index=existing;const copy={...p,roles:p.roles.map((r,i)=>i===index?{...r,alternateAppearance:true,roleType:'recurring'}:{...r}),alternateCasting:true};
    s.projects=s.projects.filter(x=>x.id!==p.id);s.projects.push(copy);
   }else{
    const previous=projects(s,catalogue).find(p=>p.id===c.lastProjectId),credit=s.filmography.find(f=>f.projectId===c.lastProjectId&&f.personId===c.personId),old=previous?.roles.find(r=>characterKey(r.character)===c.characterKey)||c.role;
    if(!old&&!credit)continue;
    const role={...(old||{character:c.character,actor:credit.original||'Historical performer',gender:active(s).gender,birthYear:active(s).birthYear,ageMin:4,ageMax:100}),alternateAppearance:true};
    if(old){const gap=p.year-(previous?.year||credit.year);if(role.characterAge!=null)role.characterAge+=gap;role.ageMin+=gap;role.ageMax+=gap}
    // Store only the player-owned alternate production; never mutate the shared real catalogue.
    const copy={...p,roles:[...p.roles,role],alternateCasting:true};s.projects=s.projects.filter(x=>x.id!==p.id);s.projects.push(copy);index=copy.roles.length-1;
   }
  }
  const target=s.projects.find(x=>x.id===p.id)||p,role=target.roles[index];if(!role||characterKey(role.character)!==c.characterKey)continue;
  const t=projectSchedule(target);if(currentDate(s)<t.castingStart||currentDate(s)>=t.filmingStart)continue;
  if(s.filmography.some(f=>f.personId===c.personId&&f.projectId===p.id&&f.status!=='withdrawn'))continue;
  if(pendingOffers(s).some(o=>o.projectId===p.id&&o.index===index))continue;
  if(!genderCompatible(active(s).gender,role.gender))continue;
  makeOffer(s,target,index,{source:request.alternate?'alternate-return':'tv-return',tvCareerId:c.seriesId?c.id:null,fee:c.lastFee||28000,expiresOn:t.filmingStart});
  if(c.seriesId)c.next={id:target.id,year:target.year,releaseDate:target.releaseDate,kind:target.kind,voteCount:target.voteCount,popularity:target.popularity,filmingStartDate:target.filmingStartDate,filmingEndDate:target.filmingEndDate,castingStartDate:target.castingStartDate};
 }
 s.continuityRequests=s.continuityRequests.filter(r=>{const p=projects(s,catalogue).find(p=>p.id===r.projectId);return !p||currentDate(s)<projectSchedule(p).filmingStart});
}
export function continuityTick(s,catalogue,{shows={},franchises={collections:{}},overrides={exits:[]}}={}){
 ensureCareer(s);if(s.complete)return;migrateSeriesCareers(s,catalogue,shows);
 const all=projects(s,catalogue),byId=new Map(all.map(p=>[p.id,p]));
 for(const c of s.tvCareers.filter(c=>c.personId===s.activeId)){
  const show=shows[c.seriesId],credit=s.filmography.find(f=>f.projectId===c.lastProjectId&&f.personId===c.personId),base=byId.get(c.lastProjectId)||c.legacyBase;
  if(!credit||!['post-production','released'].includes(credit.status)||!show&&!base?.generated)continue;
  const performance=outcomeStrength(s,credit),rawNext=nextSeason(show,c.lastSeason),next=rawNext?{...rawNext,kind:'TV series',voteCount:base?.voteCount,popularity:base?.popularity}:null,exit=characterExit(overrides,c.seriesId,c.character,c.lastSeason);
  if(!c.handled.includes(credit.projectId)){
   c.fans=clamp(Math.round(c.handled.length?c.fans*.35+performance*.65:performance*.85),0,100);c.handled.push(credit.projectId);
  }
  if(c.status==='left'){
   if(c.departureResolved)continue;
   if(c.fans>=45&&next&&decide(s,`leave:${c.id}:${c.lastSeason}`,.35)&&!s.showChanges[c.seriesId]){
    s.showChanges[c.seriesId]={status:'cancelled',afterSeason:c.lastSeason,date:currentDate(s)};
    mark(s,`After your departure, ${c.title} struggles to recover its audience. The network cancels it earlier in this timeline.`,{seriesId:c.seriesId,type:'cancellation'});
   }
   c.departureResolved=true;
   continue
  }
  if(c.status!=='active')continue;
  if(generic(c.characterKey)){c.status='ended';c.next=null;continue}
  if(s.showChanges[c.seriesId]?.status==='cancelled'){c.status='ended';c.next=null;continue}
  const threshold=c.fans>=70&&performance>=75;
  if(next){
   if(!next.roles?.length){c.status='unverified';c.next=null;mark(s,`The next season’s cast data is unavailable. A returning role for ${c.character} cannot yet be confirmed.`,{seriesId:c.seriesId,type:'unverified'});continue}
   const matching=exit?null:matchingRole(next,c);
   if(matching){requestReturn(s,c,{...next,index:matching.index});continue}
   if(!exit&&next.roles.filter(r=>characterKey(r.character)===c.characterKey).length>1){c.status='unverified';c.next=null;mark(s,`The available credits do not uniquely identify a returning appearance for ${c.character}. No continuation is promised.`,{seriesId:c.seriesId,type:'unverified'});continue}
   if(threshold&&decide(s,`save-character:${c.id}:${c.lastSeason}`,.65)){
    requestReturn(s,c,next,{alternate:true});
    if(!c.savedDeparture){c.savedDeparture=true;mark(s,`The writers change their plans for ${c.character}. Audience support convinces them to keep you in ${c.title}.`,{seriesId:c.seriesId,type:'character-survives'})}
   }else{
    c.status='written-out';c.next=null;c.departure=exit?.reason||'The character is not in the next season’s verified credits.';
    mark(s,exit?.type==='death'?`Your final season as ${c.character} in ${c.title} ends with the character’s death. Your acting career continues.`:`Your current run as ${c.character} in ${c.title} ends. The next season continues without this character.`,{seriesId:c.seriesId,type:exit?.type||'departure'});
   }
  }else{
   // A continuing show beyond the dated data becomes explicitly fictional after 2026.
   const ongoing=!show||['Returning Series','In Production','Planned'].includes(show.status);
   if(ongoing&&base){
    if(base.alternateSeason&&decide(s,`alternate-cancel:${c.id}:${c.lastSeason}`,performance<45?.45:.08)){c.status='ended';s.showChanges[c.seriesId]={status:'cancelled',afterSeason:c.lastSeason,date:currentDate(s)};mark(s,`The network decides against another season of ${c.title} in this timeline.`,{seriesId:c.seriesId,type:'cancellation'});continue}
    const p=fictionalSeason(s,c,base,{year:Math.max(2027,base.year+1)});
    const index=p.roles.findIndex(r=>characterKey(r.character)===c.characterKey);if(index>=0)requestReturn(s,c,{...p,index});
   }else if(!show?.seasons.length){continue}
   else if(base&&threshold&&decide(s,`save-show:${c.id}:${c.lastSeason}`,show.status==='Canceled'?.65:.25)){
    const p=fictionalSeason(s,c,base),index=p.roles.findIndex(r=>characterKey(r.character)===c.characterKey);requestReturn(s,c,{...p,index});
    if(!s.showChanges[c.seriesId]){s.showChanges[c.seriesId]={status:'renewed',date:currentDate(s)};mark(s,`Your performance helps win another season of ${c.title}. Its future now differs from the original timeline.`,{seriesId:c.seriesId,type:'renewal'})}
   }else{c.status=exit?.type==='death'?'written-out':'ended';c.next=null;mark(s,`${c.title} reaches the end of this run. There is no further returning season for ${c.character}.`,{seriesId:c.seriesId,type:'ending'})}
  }
 }
 for(const c of s.filmCareers.filter(c=>c.personId===s.activeId&&!c.handled)){
  const p=byId.get(c.lastProjectId),credit=s.filmography.find(f=>f.projectId===c.lastProjectId&&f.personId===c.personId);if(!p||credit?.status!=='released')continue;
  const next=franchises.collections?.[c.collectionId]?.parts.find(part=>part.releaseDate>p.releaseDate&&part.year<=p.year+10);if(!next){c.handled=true;continue}
  const appears=next.roles.some(r=>characterKey(r.character)===c.characterKey);
  if(!appears&&outcomeStrength(s,credit)>=80&&decide(s,`film-return:${c.id}`,.5)){
   requestReturn(s,c,next,{alternate:true});mark(s,`Audience enthusiasm for ${c.character} inspires a new returning appearance in the next film. This franchise is taking a different path.`,{projectId:p.id,type:'film-return'});
  }
  c.handled=true;
 }
 materializeReturns(s,catalogue);
}
