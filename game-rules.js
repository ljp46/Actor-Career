// Shared simulation rules: no UI or engine dependencies.
export const limit=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
export const dateOf=s=>s.date||`${s.year}-${String(s.month).padStart(2,'0')}-28`;
export const plusDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
export function fingerprint(x){let h=2166136261;for(const c of String(x))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
export function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296}
export const characterIdentity=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\((?:voice|uncredited)\)/gi,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function feed(s,title,body){s.timeline.unshift({year:s.year,month:s.month,date:dateOf(s),title,body});s.timeline.length=Math.min(s.timeline.length,250)}
export function ensureOverhaul(s){
 s.lifeProfiles??={};s.lifeProfiles[s.activeId]??={publicImage:55,identities:{},genreIdentity:{},lastRelease:dateOf(s),lifestyle:'family',income:0,expenses:0,debt:0};
 s.applications??=[];s.lifeEvents??=[];s.awards??=[];s.commitments??=[];s.productionCalendar??=[];s.publicSightings??=[];s.assessmentCache??={};s.recastOpportunities??={};s.advanceRemaining??=0;
 if(s.overhaulVersion!==5){
  s.overhaulVersion=5;s.migratedOverhaulOn=dateOf(s);
  for(const c of s.filmography){if(c.status==='released'||c.status==='post-production'){c.paidNet??=Math.round((c.fee||0)*(1-(c.agentCommission||0)));c.overhaulLegacy=true}else c.paidNet??=0}
  // Existing agent approaches are honoured, but future unsolicited offers use the new fame threshold.
 }
 return s.lifeProfiles[s.activeId];
}
export function castingReason(s,p,index){
 if(!s.overhaulVersion)return '';
 const group=p.seriesId||p.collectionId,owner=group&&s.roleOwners?.[`${group}:${characterIdentity(p.roles[index]?.character)}`];
 const lock=p.incumbents?.[index]||(owner&&owner.originProjectId!==p.id?{firstYear:owner.year}:null);if(!lock||s.allowRecasting||s.recastOpportunities?.[`${p.id}:${index}`]>dateOf(s))return '';
 return `Established character: already played in ${lock.firstYear}. Returning roles are not open auditions.`;
}
export function projectReach(p){return limit(Math.round(Math.log10(1+Number(p.voteCount||0))*23+Math.log10(1+Number(p.popularity||0))*9),10,100)}
const assessmentMemo=new WeakMap();
export function roleAssessment(s,p,index){
 const epoch=`${s.activeId}:${dateOf(s)}:${s.skills?.acting}:${s.filmography.length}`;let memo=assessmentMemo.get(s);if(!memo||memo.epoch!==epoch){memo={epoch,projects:new WeakMap()};assessmentMemo.set(s,memo)}
 let cached=memo.projects.get(p);if(!cached){cached=new Map();memo.projects.set(p,cached)}if(cached.has(index))return cached.get(index);
 const role=p.roles[index],h=fingerprint(`${p.id}:${index}`),reach=projectReach(p),episodeShare=role.episodeCount&&p.episodeCount?role.episodeCount/p.episodeCount:null;
 const prominence=role.roleType==='guest'?18:index<3?100:index<8?65:index<16?40:18;
 const billing=prominence>=90?'Lead':prominence>=40?'Supporting':'Guest / featured';
 const scriptBase=limit(Math.round((Number(p.baselineRating)||6.3)*9+(fingerprint(p.id)%17)-8),25,96);
 const qualityBase=limit(Math.round(scriptBase*.65+22+(h%27)-13+(episodeShare===null?0:episodeShare*5)),20,98);
 const experience=s.filmography.filter(c=>c.personId===s.activeId&&c.status==='released').length,uncertainty=Math.max(3,20-experience-(s.skills?.acting||0)/10-(s.careerProfiles?.[s.activeId]?.agent?.level||0)*2);
 const script=limit(Math.round(scriptBase+((h%101)/50-1)*uncertainty),1,99),quality=limit(Math.round(qualityBase+((h%73)/36-1)*uncertainty),1,99);
 const adjective=n=>n>=85?'Exceptional':n>=70?'Strong':n>=55?'Promising':n>=40?'Uneven':'Uncertain';
 const budget=p.budget>0?p.budget:Math.round((p.kind==='TV series'?2e6:6e5)*Math.pow(1+reach/35,3));
 const result={script,quality,scriptBase,qualityBase,prominence,billing,reach,budget,budgetEstimated:!p.budget,
  scriptDescription:`${adjective(script)} writing · ${['intimate character story','ambitious structure','accessible crowd-pleaser','demanding emotional material'][h%4]}`,
  roleDescription:`${adjective(quality)} material · ${prominence<40?'small but potentially memorable':prominence<90?'a supporting part with room to stand out':'a substantial character carrying the story'}`,
  uncertainty:Math.round(uncertainty)};cached.set(index,result);return result;
}
export const eraValue=year=>Math.max(.08,Math.min(1.6,Math.pow(1.025,year-2026)));
export function offeredFee(s,p,index){
 const a=roleAssessment(s,p,index),profile=s.careerProfiles?.[s.activeId]||{},agent=profile.agent?.level||0;
 const share=a.prominence>=90?.008:a.prominence>=40?.0025:.00035;
 const leverage=(1+Math.pow((s.fame||0)/100,2)*18+(profile.reputation||50)/250+agent*.12)*(1+((s.lifeProfiles?.[s.activeId]?.publicImage??55)-55)/500);
 let fee=a.budget*share*leverage*eraValue(p.year);
 if(p.kind==='TV series')fee*=Math.min(1,(p.roles[index].episodeCount||p.episodeCount||8)/(p.episodeCount||8));
 return Math.round(limit(fee,300*eraValue(p.year),30e6*eraValue(p.year)));
}
export function typecastPressure(s,p,index){
 const profile=ensureOverhaul(s),a=roleAssessment(s,p,index),genre=p.genre||'Drama',identity=profile.identities[`${p.seriesId||p.collectionId||p.id}:${characterIdentity(p.roles[index].character)}`];
 const strongest=Object.values(profile.identities).sort((a,b)=>b.strength-a.strength)[0];
 if(!strongest||strongest.strength<50||identity===strongest)return 0;
 const genreMatch=strongest.genre===genre;
 return limit((strongest.strength-45)*(genreMatch?.25:.6)-(profile.range||0)*.35,0,35);
}
export function knownFor(s){const p=ensureOverhaul(s),top=Object.values(p.identities).sort((a,b)=>b.strength-a.strength)[0];return !top?'Still building your identity':top.strength>=65?`Strongly associated with ${top.character}`:top.strength>=30?`Known for ${top.character} · ${top.genre}`:p.range>=30?'Building a reputation for range':`Finding your audience · ${top.genre}`}
export function syncCalendar(s,projects,schedule){
 const ids=new Set(s.filmography.filter(c=>c.personId===s.activeId&&!['released','withdrawn'].includes(c.status)).map(c=>c.projectId));
 s.productionCalendar=projects.filter(p=>ids.has(p.id)).map(p=>{const t=schedule(p);return {id:p.id,title:p.title,start:t.filmingStart,end:t.filmingEnd}});
 for(const c of (s.contracts||[]).filter(c=>c.personId===s.activeId&&c.status==='active'))for(const e of c.entries.filter(e=>['reserved','offered'].includes(e.status))){const t=schedule(e.project);s.productionCalendar.push({id:e.project.id,title:e.project.title,start:t.filmingStart,end:t.filmingEnd})}
 for(const c of (s.tvCareers||[]).filter(c=>c.personId===s.activeId&&c.status==='active'&&c.next)){const t=schedule(c.next);if(!s.productionCalendar.some(p=>p.id===c.next.id))s.productionCalendar.push({id:c.next.id,title:c.next.title,start:t.filmingStart,end:t.filmingEnd})}
}
export function calendarReason(s,start,end,except=null){
 const clash=[...(s.productionCalendar||[]),...(s.commitments||[]).filter(c=>c.personId===s.activeId&&c.status==='scheduled')].find(c=>c.id!==except&&start<c.end&&c.start<end);
 return clash?`Conflicts with ${clash.title} (${clash.start}–${clash.end}).`:'';
}
export function reserve(s,{id,title,start,end,kind,guestId=null}){const reason=calendarReason(s,start,end,id);if(reason)throw Error(reason);const c={id,title,start,end,kind,guestId,status:'scheduled',personId:s.activeId};s.commitments.push(c);return c}
export function openLifeEvent(s){return (s.lifeEvents||[]).find(e=>e.personId===s.activeId&&e.status==='open')}
export function queueEvent(s,type,title,body,options,data={},key=null){
 ensureOverhaul(s);if(key&&s.lifeEvents.some(e=>e.key===key&&e.personId===s.activeId))return null;
 if(type==='casting'){const grouped=s.lifeEvents.find(e=>e.type==='casting'&&e.date===dateOf(s)&&e.personId===s.activeId&&e.status==='open');if(grouped){grouped.title='Your casting updates';grouped.body+='\n'+body;return grouped}}
 const e={id:`life-${s.nextId++}`,personId:s.activeId,type,title,body,options,data,key,status:'open',date:dateOf(s)};s.lifeEvents.push(e);
 const open=s.lifeEvents.filter(e=>e.status==='open'),closed=s.lifeEvents.filter(e=>e.status!=='open'&&daysBetween(e.date,dateOf(s))<90).slice(-80);s.lifeEvents=[...open,...closed].sort((a,b)=>a.date.localeCompare(b.date));return e;
}
export function settlePayroll(s,c,p,schedule){
 if(c.overhaulLegacy||!c.fee||c.status==='withdrawn')return;
 const t=schedule(p),net=Math.round(c.fee*(1-(c.agentCommission||0))),elapsed=daysBetween(t.filmingStart,dateOf(s)),duration=Math.max(1,daysBetween(t.filmingStart,t.filmingEnd));
 let fraction=p.kind==='TV series'?limit(elapsed/duration,0,1):elapsed<0?0:elapsed>=duration?1:elapsed>=duration/2?.65:.25;
 const due=Math.max(0,Math.round(net*fraction)-(c.paidNet||0));if(due){s.money+=due;c.paidNet=(c.paidNet||0)+due;ensureOverhaul(s).income+=due;feed(s,'Acting payment',`${c.title}: $${due.toLocaleString()} after representation fees. $${Math.max(0,net-c.paidNet).toLocaleString()} remains.`)}
}
export function reception(s,c,p){
 const a=roleAssessment(s,p,c.roleIndex||0),skills=c.skillsAtWrap||s.skills,effort=c.performance?.effort||0,team=c.performance?.teamwork||0;
 const support=Object.values(s.relationships||{}).some(r=>r.dating&&r.trust>=60&&r.affection>=50&&r.lastQuality&&daysBetween(r.lastQuality,dateOf(s))<30)?3:0;
 const performance=limit(Math.round(skills.acting*.6+(skills[/comedy/i.test(p.genre)?'comedy':'drama']||0)*.18+effort*.4+team*.25+a.qualityBase*.08+support+random(s)*15));
 const direction=fingerprint(p.director)%21-10,critics=limit(Math.round(a.scriptBase*.55+performance*.28+team*.2+direction+random(s)*25-(c.creativeRisk?15:0)));
 const audience=limit(Math.round((Number(p.baselineRating)||6)*6+performance*.3+((s.lifeProfiles?.[s.activeId]?.publicImage??55)-55)/10+random(s)*25-(random(s)<.1?25:0)));
 const commercial=limit(Math.round(a.reach*.55+audience*.4+(c.promotion||0)+random(s)*15));
 const result=commercial>=70?'hit':commercial<40?'flop':'mixed reception',profile=ensureOverhaul(s),gain=limit(Math.round((a.reach*.4*a.prominence/100+(performance>=80?8:0))*Math.pow(Math.max(.08,1-s.fame/110),1.7)*(audience/100)),0,45);
 s.fame=limit(s.fame+gain);const actor=s.people.find(p=>p.id===s.activeId);if(actor)actor.fame=s.fame;
 const career=s.careerProfiles?.[s.activeId];if(career)career.reputation=limit(career.reputation+(performance>=75?5:performance<30?-3:2));
 const key=`${p.seriesId||p.collectionId||p.id}:${characterIdentity(c.role)}`,identity=profile.identities[key]??={character:c.role,genre:p.genre||'Drama',strength:0,productions:0};
 identity.strength=limit(identity.strength+a.reach*a.prominence/220);identity.productions++;
 for(const [other,i] of Object.entries(profile.identities))if(other!==key){i.strength=limit(i.strength-(critics>=65?5:2));if(i.genre!==identity.genre&&performance>=65)profile.range=limit((profile.range||0)+8)}
 profile.genreIdentity[identity.genre]=(profile.genreIdentity[identity.genre]||0)+1;profile.lastRelease=dateOf(s);
 return {personId:s.activeId,projectId:p.id,title:p.title,date:dateOf(s),performance,reception:audience,audience,critics,commercial,result,fameGain:gain,fictional:true};
}
export const assets=[
 {id:'wardrobe',name:'Premiere wardrobe',kind:'luxury',price:2000,monthly:0,minAge:16},
 {id:'car',name:'Everyday car',kind:'car',price:18000,monthly:180,minAge:17},
 {id:'flat',name:'City apartment',kind:'home',price:150000,monthly:650,minAge:18},
 {id:'home',name:'Family house',kind:'home',price:650000,monthly:1800,minAge:18},
 {id:'luxury-car',name:'Luxury sports car',kind:'car',price:240000,monthly:1800,minAge:18},
 {id:'mansion',name:'Private estate',kind:'home',price:5e6,monthly:15000,minAge:18},
 {id:'jewellery',name:'Jewellery collection',kind:'luxury',price:80000,monthly:120,minAge:18},
 {id:'yacht',name:'Private yacht',kind:'luxury',price:3e6,monthly:25000,minAge:18,minYear:1970},
 {id:'jet',name:'Private jet',kind:'luxury',price:18e6,monthly:110000,minAge:18,minYear:1970}
];
export const lifestyles={family:{name:'Family home / shared living',monthly:0},modest:{name:'Independent, modest living',monthly:1400},comfortable:{name:'Comfortable lifestyle',monthly:5000},luxury:{name:'Luxury lifestyle',monthly:25000}};
export function monthlyCosts(s){const p=ensureOverhaul(s),owned=(s.possessions||[]).filter(a=>a.ownerId===s.activeId);return Math.round(((lifestyles[p.lifestyle]?.monthly||0)+owned.reduce((n,a)=>n+(assets.find(x=>x.id===a.id)?.monthly||0),0))*eraValue(s.year))}
export function economyTick(s){
 const p=ensureOverhaul(s),date=dateOf(s);p.lastCharge??=date;
 const elapsed=daysBetween(p.lastCharge,date);if(elapsed<7)return;
 const due=Math.round(monthlyCosts(s)*elapsed/30.44);p.lastCharge=date;p.expenses+=due;
 if(due){const paid=Math.min(Math.max(0,s.money),due);s.money-=paid;p.debt+=due-paid;if(daysBetween(p.lastStatement||'1900-01-01',date)>=28){p.lastStatement=date;feed(s,'Living costs',`Your lifestyle and possessions cost $${due.toLocaleString()} this period.${p.debt?' Unpaid living costs are recorded as debt.':''}`)}}
 if(p.debt&&s.money>0){const payment=Math.min(s.money,p.debt);s.money-=payment;p.debt-=payment}
 if(p.debt>monthlyCosts(s)*2&&!s.lifeEvents.some(e=>e.key==='budget-warning'&&daysBetween(e.date,date)<90))queueEvent(s,'budget','Your commitments are becoming expensive','Your income has not kept pace with your living costs. You can reduce spending or keep your current lifestyle.',[{id:'reduce',label:'Return to a modest lifestyle'},{id:'keep',label:'Keep the lifestyle and review my finances'}],{},'budget-warning');
 if(daysBetween(p.lastRelease,date)>365&&daysBetween(p.lastFameFade||p.lastRelease,date)>=90){p.lastFameFade=date;s.fame=limit(s.fame-(s.fame>=80?.5:1));for(const i of Object.values(p.identities))i.strength=limit(i.strength-2);p.range=limit((p.range||0)+1)}
}
