// v1.6/1.7 interface: BitLife-style life screen, assets, activities, career hub and legacy.
import {active,ageAt,currentDate,projectSchedule,filmingProjects,available,roleFit,projectPhase,train,lifestyle,genderLabel,normaliseGender} from './engine.js?v=17';
import {careerProfile,pendingOffers,pendingAuditions,preparation,prepareAudition,onSetAction} from './career.js?v=17';
import {careerHubMarkup,bindCareerHub} from './career-ui.js?v=17';
import {featuredOpportunities,applyRole,forceRole,submitAudition,buyAsset,sellAsset} from './overhaul.js?v=17';
import {ensureOverhaul,roleAssessment,knownFor,assets,eraValue,lifestyles,monthlyCosts,assetValue,dateOf} from './game-rules.js?v=17';
import {auditionPage} from './catalogue.js?v=17';
import {lifeStats,ensureLife,activities,activityReason,activityCost,doActivity,conditionsOf,conditionTypes,treat,petTypes,adoptPet,lifeSummary,ageOf} from './life.js?v=17';
import {renderWorld,awardsMarkup} from './overhaul-ui.js?v=17';
import {busyWindows} from './spinoffs.js?v=17';
import {personAge} from './relationships.js?v=17';
import {crimes,crimeReason,commitCrime,inPrison,prisonActivities,prisonReason,prisonActivity,viceStatus,criminalRecord} from './vice.js?v=17';

const initials=name=>String(name||'?').split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase();
export const avatarClass=name=>`c${[...String(name)].reduce((n,c)=>n+c.charCodeAt(0),0)%6}`;
export function avatar(p,{large=false}={}){return `<span class="avatar ${avatarClass(p.name)}${large?' large':''}${p.alive===false?' dead':''}" aria-hidden="true">${initials(p.name)}</span>`}
const statColours={happiness:'var(--happy)',health:'var(--health)',looks:'var(--looks)',fame:'var(--fame)',acting:'var(--acting)'};
export function statusLine(s){const a=active(s),age=ageOf(s),fame=s.fame;const label=viceStatus(s)||(age<5?'Toddler':age<13?'Child':age<18?'Teenager':fame>=80?'Global star':fame>=55?'Movie star':fame>=30?'Rising star':s.filmography.some(f=>f.personId===a.id)?'Working actor':'Aspiring actor');return `${label} · Age ${age}`}

// ------------------------------------------------------------------ chrome
export function renderTopbar(el,u){
 const s=u.state;if(!s){el.hidden=true;return}
 const a=active(s);el.hidden=false;
 el.innerHTML=`${avatar(a)}<div class="who"><strong>${u.esc(a.name)}</strong><span>${u.esc(s.complete?'This life has ended':statusLine(s))}</span></div><div class="cash ${s.money<0?'neg':''}">${u.money(s.money)}<small>${u.esc(u.fmtDate(currentDate(s)))}</small></div><button class="icon-btn" id="settingsButton" aria-label="Menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>`;
 el.querySelector('#settingsButton').onclick=u.openMenu;
}
export function renderDock(el,u){
 const s=u.state;if(!s||s.complete){el.hidden=true;return}
 const st=lifeStats(s);el.hidden=false;
 el.innerHTML=Object.entries({happiness:'Happiness',health:'Health',looks:'Looks',fame:'Fame',acting:'Acting'}).map(([k,label])=>`<div class="statbar${st[k]<25&&['happiness','health'].includes(k)?' low':''}" style="--c:${statColours[k]}"><span>${label}</span><div class="track"><div class="fill" style="width:${st[k]}%"></div></div><b>${st[k]}</b></div>`).join('')+`<div class="statbar" style="--c:var(--bulb)"><span>Energy</span><div class="track"><div class="fill" style="width:${Math.max(0,Math.round(s.energy??100))}%"></div></div><b>${Math.max(0,Math.round(s.energy??100))}</b></div>`;
}
export function attentionCount(s){
 if(!s)return 0;const offers=pendingOffers(s).length,invites=(s.applications||[]).filter(a=>a.personId===s.activeId&&a.status==='invited').length,callbacks=pendingAuditions(s).filter(a=>!a.automatic).length;
 return offers+invites+callbacks;
}

// --------------------------------------------------------------- life tab
function ageForEntry(s,t){const born=s.birthday,d=t.date||`${t.year}-${String(t.month||1).padStart(2,'0')}-15`;return ageAt(born,Number(d.slice(0,4)),Number(d.slice(5,7)),Number(d.slice(8,10)))}
const bigTitles=/^(Role accepted|Filming begins|Released|Release report|Wrapped|A new purchase|A purchase|Welcome|A baby|An inheritance|An engagement|Your wedding|A divorce|You won|Nominated|A new pet|Recovered|A diagnosis)/;
export function renderLife(root,u){
 const s=u.state,a=active(s);ensureLife(s);
 if(s.complete)return renderObituary(root,u);
 const pending=attentionCount(s),shoots=filmingProjects(s,u.catalogue),life=ensureOverhaul(s),conditions=conditionsOf(s);
 const groups=[];let current=null;
 const quiet=/^(Application submitted|Application decision|Interest registered|Living costs|A role offer|Your franchise return)$/;
 for(const t of s.timeline.filter(t=>!quiet.test(t.title)).slice(0,90)){const age=ageForEntry(s,t);if(!current||current.age!==age){current={age,items:[]};groups.push(current)}current.items.push(t)}
 root.innerHTML=`
 ${pending?`<button class="attention" data-go="career" data-seg="offers"><span><b>${pending} ${pending===1?'decision is':'decisions are'} waiting</b><br><small class="muted">Offers, audition invitations and callbacks</small></span><i>Open</i></button>`:''}
 <div class="this-week">
  <div class="row"><h2>${u.esc(headline(s,shoots))}</h2><span class="pill">${u.esc(lifestyles[life.lifestyle]?.name.split(/[,/]/)[0]||'')}</span></div>
  ${conditions.length?`<p class="muted">Health: ${conditions.map(c=>u.esc(c.name)).join(', ')}. See a doctor in Activities.</p>`:''}
  ${s.pregnancy&&s.pregnancy.personId===s.activeId?`<p class="muted">A baby is due ${u.esc(u.fmtDate(s.pregnancy.due))}.</p>`:''}
  <div class="chips"><button class="chip" data-skip="1" data-advance="1">Just a week</button><button class="chip" data-skip="13" data-advance="13">Skip 3 months</button><button class="chip" data-skip="52" data-advance="52">Skip a year</button>${s.advanceRemaining?`<button class="chip on" data-resume>Resume ${s.advanceRemaining} days</button>`:''}<button class="chip" data-rest>Rest a week</button></div>
 </div>
 <div class="log">${groups.map(g=>`<div class="log-age"><h2>${g.age<0?'Before you were born':`Age ${g.age}`}</h2><span>${u.esc(String((g.items[0].date||String(g.items[0].year)).slice(0,4)))}</span></div>${g.items.map(t=>`<div class="log-item${bigTitles.test(t.title)?' big':''}"><strong>${u.esc(t.title)}</strong>${t.body?`<p>${u.esc(t.body)}</p>`:''}</div>`).join('')}`).join('')||'<p class="empty">Your story starts here. Tap the big button to live your first month.</p>'}</div>`;
 bindGo(root,u);
 root.querySelectorAll('[data-skip]').forEach(b=>b.onclick=()=>u.advanceWeeks(Number(b.dataset.skip)));
 root.querySelector('[data-resume]')?.addEventListener('click',()=>u.advanceWeeks(0,{resume:true}));
 root.querySelector('[data-rest]').onclick=async()=>{try{lifestyle(s,'rest');u.save();await u.advanceWeeks(1)}catch(e){u.toast(e.message)}};
}
function headline(s,shoots){
 if(inPrison(s))return `In prison until ${new Date(s.prison.until+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}`;
 if(s.wanted?.personId===s.activeId)return 'On the run from the police';
 const age=ageOf(s),credits=s.filmography.filter(f=>f.personId===s.activeId),booked=credits.find(f=>f.status==='booked');
 if(shoots.length)return `Filming ${shoots[0].title}`;
 if(booked)return `Booked: ${booked.title}`;
 if(age<4)return 'Too young to work';
 if(!credits.length)return age<18?'Dreaming of the screen':'Looking for your first role';
 return knownFor(s);
}
function renderObituary(root,u){
 const s=u.state,last=s.legacies?.[0],a=active(s);
 root.innerHTML=last?`<section class="obit">${avatar({...a,alive:false},{large:true})}<h1>${u.esc(last.name)}</h1><p class="years">${u.esc(String(last.born).slice(0,4))}–${u.esc(last.died.slice(0,4))} · died aged ${last.age} from ${u.esc(last.cause||'unknown causes')}</p><span class="ribbon">${u.esc(last.ribbon.name)}</span><p class="muted">${u.esc(last.ribbon.why)}</p><div class="obit-stats"><div><b>${last.credits}</b><span>Credits</span></div><div><b>${last.awardsWon}</b><span>Awards won</span></div><div><b>${last.peakFame}</b><span>Peak fame</span></div><div><b>${u.money(last.netWorth)}</b><span>Net worth</span></div><div><b>${last.children}</b><span>Children</span></div><div><b>${last.score}</b><span>Legacy score</span></div></div>${last.bestKnown?`<p class="muted" style="margin-top:12px">Best known for ${u.esc(last.bestKnown)}.</p>`:''}</section><div class="sheet-actions"><button class="primary" data-go="legacy">See the family legacy</button><button class="secondary" id="newLife">Start a new life</button></div>`:`<div class="empty">This life has ended.</div><div class="sheet-actions"><button class="secondary" id="newLife">Start a new life</button></div>`;
 bindGo(root,u);root.querySelector('#newLife').onclick=u.newLife;
}
function bindGo(root,u){root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>u.navigate(b.dataset.go,{seg:b.dataset.seg}))}

// ------------------------------------------------------------- career tab
let careerSeg='auditions',auditionQuery='',auditionKind='',auditionPg=0;
export function setCareerSeg(seg){if(seg)careerSeg=seg}
export function renderCareer(root,u){
 const s=u.state,c=u.catalogue,a=active(s),profile=careerProfile(s);
 const offers=pendingOffers(s).length,invites=(s.applications||[]).filter(x=>x.personId===s.activeId&&x.status==='invited').length;
 const segs=[['auditions','Auditions',invites],['offers','Offers & deals',offers],['credits','My work',0],['world','World',0]];
 const head=`<div class="screen-head"><div><h1>Career</h1><p>Reputation ${Math.round(profile.reputation)} · ${u.esc(profile.agent?profile.agent.name:'No agent')} · ${u.esc(knownFor(s))}</p></div></div><div class="seg" role="tablist">${segs.map(([id,l,n])=>`<button role="tab" data-seg="${id}" class="${careerSeg===id?'on':''}">${l}${n?`<span class="count">${n}</span>`:''}</button>`).join('')}</div><div id="careerBody"></div>`;
 root.innerHTML=head;const body=root.querySelector('#careerBody');
 root.querySelectorAll('[data-seg]').forEach(b=>b.onclick=()=>{careerSeg=b.dataset.seg;renderCareer(root,u)});
 if(careerSeg==='world')return renderWorld(body,u);
 if(careerSeg==='offers'){body.innerHTML=careerHubMarkup(s,c,u.franchiseData,{esc:u.esc,money:u.money,fmtDate:u.fmtDate})||'<p class="empty">No offers right now.</p>';bindCareerHub(body,{state:s,catalogue:c,data:u.franchiseData,action:u.action,save:u.save,render:u.render,loadCareerYears:u.loadCareerYears,toast:u.toast,modal:u.modal});return}
 if(careerSeg==='credits')return renderCredits(body,u);
 renderAuditions(body,u);
}
function fitClass(n){return n>=80?'':n>=65?'mid':'low'}
function renderAuditions(root,u){
 const s=u.state,c=u.catalogue,a=active(s),age=ageOf(s);
 if(normaliseGender(a.gender)==='unspecified'){root.innerHTML=`<div class="card"><h2>Choose a casting gender</h2><p>This older save needs one to find compatible roles.</p>${['male','female','nonbinary'].map(g=>`<button class="secondary" data-gender="${g}">${genderLabel(g)}</button>`).join('')}</div>`;root.querySelectorAll('[data-gender]').forEach(b=>b.onclick=()=>u.action(()=>{a.gender=b.dataset.gender}));return}
 const apps=(s.applications||[]).filter(x=>x.personId===s.activeId&&!['rejected','expired','withdrawn','accepted','declined'].includes(x.status));
 const pursued=new Set(apps.map(x=>`${x.projectId}:${x.index}`));
 const open=available(s,c).filter(o=>o.fit>50&&!pursued.has(`${o.project.id}:${o.index}`)),page=auditionPage(open,{query:auditionQuery,kind:auditionKind,page:auditionPg,pageSize:15});auditionPg=page.page;
 const shoots=filmingProjects(s,c);
 const appRow=x=>{const p=[...c,...s.projects].find(p=>p.id===x.projectId);const label={watching:'Waiting for casting to open',considering:'Under consideration',invited:'Invited to audition',callback:'Callback booked',offered:'Offer received'}[x.status]||x.status;return `<div class="list-row"><div class="main"><strong>${u.esc(x.title)}</strong><small>${u.esc(x.character)} · ${u.esc(label)}${p&&['invited','callback'].includes(x.status)?` · prep ${preparation(s,p,x.index)}/60`:''}</small>${x.status==='invited'?`<div><button class="small" data-app-prepare="${u.esc(x.id)}">Study script</button><button class="small" data-app-coach="${u.esc(x.id)}">Coach</button><button class="primary" data-app-submit="${u.esc(x.id)}">Audition</button></div>`:''}${x.status==='offered'?`<div><button class="primary" data-seg-go="offers">Review offer</button></div>`:''}</div>${['invited','considering','callback'].includes(x.status)?`<button class="small" data-app-force="${u.esc(x.id)}">Force win</button>`:''}</div>`};
 const roleRow=(o,featuredRow=false)=>{const as=roleAssessment(s,o.project,o.index),t=projectSchedule(o.project);return `<div class="list-row"${featuredRow?' data-opportunity':''}><div class="main"><strong>${u.esc(o.project.title)}</strong><small>${u.esc(o.role.character)} · ${u.esc(as.billing)} · ${u.esc(o.project.kind==='TV series'?'TV':'Film')} ${o.project.year}</small><small>Script ${as.script} · Role ${as.quality} · films ${u.esc(u.fmtDate(t.filmingStart))}</small><div><button class="primary" data-apply="${u.esc(o.project.id)}" data-index="${o.index}">Apply</button><button class="small" data-force-role="${u.esc(o.project.id)}" data-index="${o.index}">Force win</button></div></div><div class="side"><span class="fit ${fitClass(o.fit)}">${o.fit}%</span><br>fit</div></div>`};
 const featured=featuredOpportunities(s,c).recommendations;
 root.innerHTML=`${inPrison(s)?`<div class="notice">You cannot audition from prison. Your release date is ${u.esc(u.fmtDate(s.prison.until))}.</div>`:''}
 ${shoots.map(p=>`<div class="card"><div class="row"><h2>On set: ${u.esc(p.title)}</h2><span class="pill">until ${u.esc(u.fmtDate(projectSchedule(p).filmingEnd))}</span></div><p class="muted">Filming happens automatically. Extra effort here improves your performance.</p><button class="outline" data-onset="rehearse" data-project="${u.esc(p.id)}">Rehearse scenes</button><button class="outline" data-onset="teamwork" data-project="${u.esc(p.id)}">Support the cast</button><button class="outline" data-onset="rest" data-project="${u.esc(p.id)}">Rest between takes</button></div>`).join('')}
 ${apps.length?`<div class="section-title">Your applications</div><div class="list">${apps.map(appRow).join('')}</div>`:''}
 ${featured.length?`<div class="section-title">Picked for you</div><div class="list" id="featured">${featured.map(o=>roleRow(o,true)).join('')}</div>`:''}
 <div class="section-title">All open roles you fit</div>
 <div class="circle-toolbar"><input id="auditionSearch" placeholder="Search title, character or director" value="${u.esc(auditionQuery)}" aria-label="Search open roles"><select id="auditionKind" aria-label="Production type"><option value="">All</option><option value="Film" ${auditionKind==='Film'?'selected':''}>Films</option><option value="TV series" ${auditionKind==='TV series'?'selected':''}>TV</option></select></div>
 <div class="list">${page.offers.map(o=>roleRow(o)).join('')||`<p class="empty">${age<4?'Too young to audition yet.':'Nothing casting that fits you right now. Time moves on, so check back next week, or browse World.'}</p>`}</div>
 ${page.pages>1?`<div class="row"><button class="small" id="audPrev" ${page.page===0?'disabled':''}>Previous</button><span class="muted">${page.page+1} of ${page.pages} · ${page.total} roles</span><button class="small" id="audNext" ${page.page>=page.pages-1?'disabled':''}>Next</button></div>`:''}`;
 const find=id=>[...c,...s.projects].find(p=>p.id===id);
 root.querySelectorAll('[data-apply]').forEach(b=>b.onclick=()=>u.action(()=>{const p=find(b.dataset.apply);applyRole(s,c,p,Number(b.dataset.index),{watch:projectPhase(s,p)==='Announced'});u.toast('Applied. You will hear back as the weeks pass.')}));
 root.querySelectorAll('[data-force-role]').forEach(b=>b.onclick=()=>u.action(()=>{forceRole(s,c,find(b.dataset.forceRole),Number(b.dataset.index));careerSeg='offers'}));
 root.querySelectorAll('[data-app-prepare],[data-app-coach]').forEach(b=>b.onclick=()=>u.action(()=>{const x=s.applications.find(x=>x.id===(b.dataset.appPrepare||b.dataset.appCoach));prepareAudition(s,c,find(x.projectId),x.index,b.dataset.appCoach?'coach':'script')}));
 root.querySelectorAll('[data-app-submit]').forEach(b=>b.onclick=()=>{let out;u.action(()=>{out=submitAudition(s,c,b.dataset.appSubmit)});if(out)u.showResult(out.stage==='offer'?'They want you':out.stage==='callback'?'Callback!':'Not this time',out.stage==='offer'?'The offer is waiting in Offers & deals.':out.stage==='callback'?'The final decision comes in a few days.':'The production went with someone else.')});
 root.querySelectorAll('[data-app-force]').forEach(b=>b.onclick=()=>u.action(()=>{const x=s.applications.find(x=>x.id===b.dataset.appForce);if(x.status==='callback'){const cb=s.careerAuditions.find(y=>y.id===x.callbackId);if(cb)cb.status='withdrawn';x.status='invited'}submitAudition(s,c,x.id,{forceWin:true});careerSeg='offers'}));
 root.querySelectorAll('[data-seg-go]').forEach(b=>b.onclick=()=>{careerSeg=b.dataset.segGo;u.render()});
 root.querySelectorAll('[data-onset]').forEach(b=>b.onclick=()=>u.action(()=>onSetAction(s,c,b.dataset.project,b.dataset.onset)));
 const search=root.querySelector('#auditionSearch');search.oninput=e=>{const pos=e.target.selectionStart;auditionQuery=e.target.value;auditionPg=0;renderAuditions(root,u);const i=root.querySelector('#auditionSearch');i.focus();i.setSelectionRange(pos,pos)};
 root.querySelector('#auditionKind').onchange=e=>{auditionKind=e.target.value;auditionPg=0;renderAuditions(root,u)};
 root.querySelector('#audPrev')?.addEventListener('click',()=>{auditionPg--;renderAuditions(root,u)});root.querySelector('#audNext')?.addEventListener('click',()=>{auditionPg++;renderAuditions(root,u)});
}
function scheduleMarkup(s,u){
 const items=busyWindows(s,u.catalogue).sort((a,b)=>a.start.localeCompare(b.start));if(!items.length)return '';
 const clash=i=>items.some((o,j)=>j!==i&&o.start<items[i].end&&items[i].start<o.end);
 return `<div class="section-title">Your schedule</div><div class="list">${items.map((x,i)=>`<div class="list-row"><span class="emoji">${/expected/.test(x.title)?'🔮':'🎬'}</span><div class="main"><strong>${u.esc(x.title)}</strong><small>${u.esc(u.fmtDate(x.start))} – ${u.esc(u.fmtDate(x.end))}${/expected/.test(x.title)?' · estimated next season':''}</small>${clash(i)?'<span class="why" style="color:var(--danger)">Overlaps another commitment</span>':''}</div></div>`).join('')}</div><p class="muted" style="margin:0 2px 10px">New offers that land on these dates will tell you exactly what they clash with. Spin-offs are scheduled around your shows' expected seasons.</p>`;
}
function renderCredits(root,u){
 const s=u.state,a=active(s),credits=s.filmography.filter(f=>f.personId===a.id).sort((x,y)=>(y.year-x.year)||String(y.bookedOn||'').localeCompare(String(x.bookedOn||'')));
 const won=(s.awards||[]).filter(x=>x.personId===a.id&&x.status==='won'&&!x.productionAward).length;
 root.innerHTML=`<div class="money-grid"><div><span>Credits</span><b>${credits.length}</b></div><div><span>Released</span><b>${credits.filter(f=>!f.status||f.status==='released').length}</b></div><div><span>Awards won</span><b>${won}</b></div><div><span>Reputation</span><b>${Math.round(careerProfile(s).reputation)}</b></div></div>
 ${scheduleMarkup(s,u)}
 ${awardsMarkup(s,{esc:u.esc,fmtDate:u.fmtDate})}
 <div class="list">${credits.map(f=>`<div class="list-row"><div class="main"><strong>${u.esc(f.title)}</strong><small>${f.year} · ${u.esc(f.kind==='TV series'?'TV':'Film')} · as ${u.esc(f.role)}</small>${f.outcome?`<small>${u.esc(f.outcome.result)} · critics ${f.outcome.critics} · audience ${f.outcome.audience}</small>`:''}</div><div class="side"><b>${u.esc(f.status==='released'||!f.status?'Released':f.status)}</b>${f.outcome?`${f.outcome.performance}/100`:''}</div></div>`).join('')||'<p class="empty">No credits yet. Your first role is out there.</p>'}</div>`;
}

// --------------------------------------------------------------- assets tab
let assetSeg='home';
const kindLabel={home:'Homes',car:'Vehicles',luxury:'Luxury',collectible:'Collectibles',pet:'Pets'};
const kindIcon={home:'🏠',car:'🚗',luxury:'💎',collectible:'🖼️',pet:'🐾'};
export function renderAssets(root,u){
 const s=u.state,a=active(s),age=ageOf(s),life=ensureOverhaul(s),owned=(s.possessions||[]).filter(p=>p.ownerId===a.id),pets=(s.pets||[]).filter(p=>p.ownerId===a.id&&p.alive);
 const worth=s.money+owned.reduce((n,x)=>n+assetValue(s,x),0);
 const shop=assetSeg==='pet'?petTypes.map(t=>{const price=Math.round(t.price*eraValue(s.year)),why=age<t.minAge?`From age ${t.minAge}`:s.money<price?'Not enough money':'';return `<div class="list-row${why?' disabled':''}"><span class="emoji">🐾</span><div class="main"><strong>${u.esc(t.species)}</strong><small>${u.money(t.monthly*eraValue(s.year))}/month · lives about ${t.lifespan} years</small>${why?`<span class="why">${u.esc(why)}</span>`:''}</div><div class="side"><b>${u.money(price)}</b><button class="primary" data-adopt="${t.id}" ${why?'disabled':''}>Adopt</button></div></div>`}).join(''):assets.filter(x=>(x.kind===assetSeg||assetSeg==='luxury'&&x.kind==='collectible')&&s.year>=(x.minYear||1960)).map(x=>{const price=Math.round(x.price*eraValue(s.year)),has=owned.some(o=>o.id===x.id),why=has?'You own this':age<x.minAge?`From age ${x.minAge}`:s.money<price?'Not enough money':'';return `<div class="list-row${why&&!has?' disabled':''}"><span class="emoji">${kindIcon[x.kind]}</span><div class="main"><strong>${u.esc(x.name)}</strong><small>${x.monthly?`${u.money(x.monthly*eraValue(s.year))}/month upkeep`:'No upkeep'}</small>${why?`<span class="why">${u.esc(why)}</span>`:''}</div><div class="side"><b>${u.money(price)}</b><button class="primary" data-buy-asset="${x.id}" ${why?'disabled':''}>Buy</button></div></div>`}).join('');
 root.innerHTML=`<div class="screen-head"><div><h1>Assets</h1><p>Spend what the work pays. Homes appreciate; cars do not.</p></div></div>
 <div class="money-grid"><div><span>Cash</span><b>${u.money(s.money)}</b></div><div><span>Net worth</span><b>${u.money(worth)}</b></div><div><span>Monthly costs</span><b>${u.money(monthlyCosts(s))}</b></div><div><span>${life.debt?'Debt':'Earned so far'}</span><b>${u.money(life.debt||life.income)}</b></div></div>
 <label for="livingStandard">How you live</label><select id="livingStandard">${Object.entries(lifestyles).map(([k,v])=>`<option value="${k}" ${life.lifestyle===k?'selected':''} ${age<18&&k!=='family'?'disabled':''}>${u.esc(v.name)} · ${u.money(v.monthly*eraValue(s.year))}/month</option>`).join('')}</select>
 <p class="muted">Owning a home cuts your living costs by almost two thirds.</p>
 <div class="section-title">What you own</div>
 <div class="list">${owned.map(o=>{const x=assets.find(y=>y.id===o.id);return `<div class="list-row"><span class="emoji">${kindIcon[x?.kind]||'📦'}</span><div class="main"><strong>${u.esc(o.name)}</strong><small>Bought ${o.year} for ${u.money(o.paid||0)}</small></div><div class="side"><b>${u.money(assetValue(s,o))}</b><button class="small" data-sell="${u.esc(o.id)}">Sell</button></div></div>`}).join('')}${pets.map(p=>`<div class="list-row"><span class="emoji">🐾</span><div class="main"><strong>${u.esc(p.name)}</strong><small>${u.esc(p.species)} · ${Math.max(0,s.year-Number(p.born.slice(0,4)))} years old</small></div></div>`).join('')}${!owned.length&&!pets.length?'<p class="empty">Nothing yet.</p>':''}</div>
 <div class="section-title">Shop</div>
 <div class="seg">${['home','car','luxury','pet'].map(k=>`<button data-shop="${k}" class="${assetSeg===k?'on':''}">${kindLabel[k]}</button>`).join('')}</div>
 <div class="list">${shop||'<p class="empty">Nothing for sale in this era.</p>'}</div>`;
 root.querySelector('#livingStandard').onchange=e=>u.action(()=>{life.lifestyle=e.target.value});
 root.querySelectorAll('[data-shop]').forEach(b=>b.onclick=()=>{assetSeg=b.dataset.shop;renderAssets(root,u)});
 root.querySelectorAll('[data-buy-asset]').forEach(b=>b.onclick=()=>{const x=assets.find(y=>y.id===b.dataset.buyAsset);u.action(()=>buyAsset(s,x.id));if(s.possessions.some(o=>o.id===x.id&&o.ownerId===a.id))u.showResult(`You bought: ${x.name}`,x.kind==='home'?'Welcome home. Your rent drops and you are a little happier.':'Enjoy it.',kindIcon[x.kind])});
 root.querySelectorAll('[data-sell]').forEach(b=>b.onclick=()=>{const o=owned.find(o=>o.id===b.dataset.sell);if(!confirm(`Sell ${o.name} for about ${u.money(assetValue(s,o))}?`))return;u.action(()=>sellAsset(s,o.id))});
 root.querySelectorAll('[data-adopt]').forEach(b=>b.onclick=()=>{let pet;u.action(()=>{pet=adoptPet(s,b.dataset.adopt)});if(pet)u.showResult(`Meet ${pet.name}`,`Your new ${pet.species.toLowerCase()} settles in straight away.`,'🐾')});
}

// ----------------------------------------------------------- activities tab
const actIcon={gym:'🏋️',run:'🏃',meditate:'🧘',read:'📖',doctor:'🩺',therapy:'💬',spa:'🛁',surgery:'💉',class:'🎭',improv:'🎤',theatre:'🎟️',voice:'🗣️',social:'📱',charity:'🤝',donate:'💝',club:'🪩',concert:'🎸',holiday:'✈️',lottery:'🎰',adopt:'👶'};
const crimeIcon={shoplift:'🛍️',graffiti:'🎨',pickpocket:'👛',bootleg:'📀',burglary:'🏚️',gta:'🚘',insurance:'📄',bribe:'💵',taxes:'🧾',heist:'🏦'};
const prisonIcon={yard:'🏋️',library:'📚',drama:'🎭',behave:'🤐',appeal:'⚖️',escape:'🪜'};
function renderPrison(root,u){
 const s=u.state,left=Math.max(0,Math.round((Date.parse(s.prison.until)-Date.parse(dateOf(s)))/86400000));
 root.innerHTML=`<div class="screen-head"><div><h1>Prison</h1><p>Serving time for ${u.esc(s.prison.crime)}. About ${left>60?`${Math.round(left/30.4)} months`:`${left} days`} left. ${Math.round(s.energy??100)} energy.</p></div></div>
 <div class="list">${prisonActivities.map(a=>{const why=prisonReason(s,a);return `<button class="list-row${why?' disabled':''}" data-prison="${a.id}" ${why?'disabled':''}><span class="emoji">${prisonIcon[a.id]}</span><span class="main"><strong>${u.esc(a.name)}</strong><small>${u.esc(a.blurb)}</small>${why?`<span class="why">${u.esc(why)}</span>`:''}</span><span class="side">${a.cost?`<b>${u.money(a.cost*eraValue(s.year))}</b>`:''}${a.energy?`${a.energy} energy`:''}</span></button>`}).join('')}</div>
 <p class="muted">Auditions, shopping and outings wait until you are out. Friends and family can still visit: talk to them in People.</p>`;
 root.querySelectorAll('[data-prison]').forEach(b=>b.onclick=()=>{let out;try{out=prisonActivity(s,b.dataset.prison);u.save()}catch(e){return u.toast(e.message)}u.showResult(out.title,out.body,prisonIcon[b.dataset.prison],u.render)});
}
export function renderActivities(root,u){
 if(inPrison(u.state))return renderPrison(root,u);
 const s=u.state,c=u.catalogue,conditions=conditionsOf(s),groups=[...new Set(activities.map(a=>a.group))];
 const row=a=>{const why=activityReason(s,a),cost=activityCost(s,a);return `<button class="list-row${why?' disabled':''}" data-activity="${a.id}" ${why?'disabled':''}><span class="emoji">${actIcon[a.id]||'•'}</span><span class="main"><strong>${u.esc(a.name)}</strong><small>${u.esc(a.blurb)}</small>${why?`<span class="why">${u.esc(why)}</span>`:''}</span><span class="side">${cost?`<b>${u.money(cost)}</b>`:''}${a.energy?`${a.energy} energy`:''}</span></button>`};
 root.innerHTML=`<div class="screen-head"><div><h1>Activities</h1><p>${Math.round(s.energy??100)} energy left this week. Resting or a new week refills it.</p></div></div>
 ${conditions.length?`<div class="section-title">Your health</div><div class="list">${conditions.map(x=>{const t=conditionTypes[x.type];return `<div class="list-row"><span class="emoji">🤒</span><div class="main"><strong>${u.esc(x.name)}</strong><small>Since ${u.esc(u.fmtDate(x.since))}${x.until?` · should pass by ${u.esc(u.fmtDate(x.until))}`:' · needs treatment'}</small></div><div class="side"><button class="primary" data-treat="${u.esc(x.id)}">Treat · ${u.money(t.cost*eraValue(s.year))}</button></div></div>`}).join('')}</div>`:''}
 <div class="section-title">Practice</div><div class="list">${[['acting','Practise acting','Free, +1 acting'],['drama','Practise drama','+1 drama'],['comedy','Practise comedy','+1 comedy']].map(([k,l,b])=>`<button class="list-row" data-train="${k}"><span class="emoji">${k==='comedy'?'😂':k==='drama'?'🎬':'🎭'}</span><span class="main"><strong>${l}</strong><small>${b}</small></span><span class="side">15 energy</span></button>`).join('')}</div>
 ${groups.map(g=>`<div class="section-title">${u.esc(g)}</div><div class="list">${activities.filter(a=>a.group===g).map(row).join('')}</div>`).join('')}
 <div class="section-title">Crime</div><p class="muted" style="margin:0 2px 6px">Big rewards, real consequences: fines, court and prison, and a record that follows you into casting rooms.${criminalRecord(s).filter(r=>r.convicted).length?` Your record: ${criminalRecord(s).filter(r=>r.convicted).length} conviction(s).`:''}</p><div class="list">${crimes.map(x=>{const why=crimeReason(s,x);return `<button class="list-row${why?' disabled':''}" data-crime="${x.id}" ${why?'disabled':''}><span class="emoji">${crimeIcon[x.id]}</span><span class="main"><strong>${u.esc(x.name)}</strong><small>${u.esc(x.blurb)}</small>${why?`<span class="why">${u.esc(why)}</span>`:''}</span><span class="side">${x.cost?`<b>${u.money(x.cost*eraValue(s.year))}</b>`:''}${x.energy?`${x.energy} energy`:''}</span></button>`}).join('')}</div>`;
 root.querySelectorAll('[data-crime]').forEach(b=>b.onclick=()=>{let out;try{out=commitCrime(s,c,b.dataset.crime);u.save()}catch(e){return u.toast(e.message)}u.showResult(out.title,out.body,crimeIcon[b.dataset.crime],u.render)});
 root.querySelectorAll('[data-activity]').forEach(b=>b.onclick=async()=>{let out;try{out=doActivity(s,b.dataset.activity);u.save()}catch(e){return u.toast(e.message)}u.showResult(out.title,out.body,actIcon[b.dataset.activity],async()=>{if(out.advanceDays)await u.advanceWeeks(out.advanceDays/7);else u.render()})});
 root.querySelectorAll('[data-treat]').forEach(b=>b.onclick=()=>{let out;try{out=treat(s,b.dataset.treat);u.save()}catch(e){return u.toast(e.message)}u.showResult(out.title,out.body,'🩺',u.render)});
 root.querySelectorAll('[data-train]').forEach(b=>b.onclick=()=>{try{train(s,b.dataset.train);u.save();u.toast(`${b.dataset.train[0].toUpperCase()+b.dataset.train.slice(1)} is now ${s.skills[b.dataset.train]}.`);u.render()}catch(e){u.toast(e.message)}});
}

// --------------------------------------------------------------- legacy
export function renderLegacy(root,u){
 const s=u.state,a=active(s),family=s.people.filter(p=>p.relative&&p.id!==a.id),current=lifeSummary(s,a);
 root.innerHTML=`<div class="screen-head"><div><h1>Legacy</h1><p>Every life in this family's story.</p></div></div>
 ${!s.complete?`<div class="card"><div class="row"><div class="row" style="justify-content:flex-start">${avatar(a)}<div><h2>${u.esc(a.name)}</h2><p class="muted">Living · age ${ageOf(s)}</p></div></div><span class="ribbon">${u.esc(current.ribbon.name)}</span></div><p class="muted">If this life ended today: legacy score ${current.score}. ${u.esc(current.ribbon.why)}.</p></div>`:''}
 <div class="section-title">Family</div><div class="list">${family.map(p=>`<div class="list-row">${avatar(p)}<div class="main"><strong>${u.esc(p.name)}</strong><small>${u.esc(p.relative)} · ${p.alive?`age ${personAge(s,p)}`:'died'} · ${u.esc(p.occupation)}</small></div>${s.children.includes(p.id)&&p.alive&&personAge(s,p)>=4&&!s.complete?`<button class="small" data-switch="${u.esc(p.id)}">Play as</button>`:''}</div>`).join('')||'<p class="empty">No family recorded.</p>'}</div>
 ${s.legacies?.length?`<div class="section-title">Past lives</div><div class="list">${s.legacies.map(l=>`<div class="list-row">${avatar({name:l.name,alive:false})}<div class="main"><strong>${u.esc(l.name)}</strong><small>${u.esc(String(l.born).slice(0,4))}–${u.esc(l.died.slice(0,4))} · ${l.credits} credits · ${l.awardsWon} awards · ${u.money(l.netWorth)}</small></div><div class="side"><span class="ribbon">${u.esc(l.ribbon.name)}</span><br>${l.score} pts</div></div>`).join('')}</div>`:''}
 ${s.deathNotices?.length?`<div class="section-title">In memoriam</div>${s.deathNotices.slice(0,10).map(n=>`<details><summary>${u.esc(n.headline)} · ${n.year}</summary><p class="muted">${u.esc(n.body)}</p>${n.tributes.map(t=>`<p class="muted">${u.esc(t)}</p>`).join('')}</details>`).join('')}`:''}`;
 root.querySelectorAll('[data-switch]').forEach(b=>b.onclick=()=>{if(!confirm('Switch to playing this family member? Your current character stays in the world.'))return;u.action(()=>u.switchTo(b.dataset.switch));u.navigate('life')});
}
