import {SAVE_KEY,createCareer,active,ageAt,available,audition,auditionShortlist,roleFit,childOpportunityPreview,worldProjects,projectPhase,castingYear,train,advance,eventChoice,connect,haveChild,switchTo,castFor,directorFor,generatedYear,shop,buy,datingApp,genderLabel,normaliseGender,currentDate,projectSchedule,filmingProjects,lifestyle,careerStartDate,applyCheat} from './engine.js?v=15';
import {ensureCareer,attachFranchises,careerProfile,pendingAuditions,pendingOffers,preparation,prepareAudition,startAudition,onSetAction,careerTick} from './career.js?v=15';
import {careerHubMarkup,bindCareerHub} from './career-ui.js?v=15';
import {readCatalogueResponse,mergeCatalogue,auditionPage} from './catalogue.js?v=15';
import {attachSeasons,migrateSeriesCareers,continuityTick,materializeReturns} from './continuity.js?v=15';
import {ensureRelationships} from './relationships.js?v=15';
import {renderRelationships,meetSomeone} from './relationships-ui.js?v=15';
import {migrateOverhaul,overhaulTick,nextScheduledDate} from './overhaul.js?v=15';
import {renderToday,renderWorld,awardsMarkup,presentEvent} from './overhaul-ui.js?v=15';
import {ensureOverhaul,openLifeEvent,plusDays,daysBetween,syncCalendar} from './game-rules.js?v=15';
const $=s=>document.querySelector(s),screen=$('#screen'),nav=$('#nav');let catalogue=[],state=null,tab='home',yearIndex=new Set(),loadedYears=new Set(),opportunityIndex={},dbMeta={},worldQuery='',worldPage=0,auditionQuery='',auditionKind='',auditionPageNumber=0;
let franchiseData={collections:{},projectCollections:{},ratings:{}};
let seasonIndex={shows:{}},seasonShows={},continuityOverrides={exits:[]},filmographyIndex={years:[],shows:{}};
const originalSeries=new Map();
const loadingYears=new Map();let peoplePage=0;
async function loadYear(year){
 if(!yearIndex.has(year)||loadedYears.has(year))return;
 if(loadingYears.has(year))return loadingYears.get(year);
 const pending=(async()=>{
  const compressed=dbMeta.compression==='gzip';
  const response=await fetch(`./data/years/${year}.json${compressed?'.gz':''}`);
  const data=await readCatalogueResponse(response,compressed);
  if(data.year!==year||!Array.isArray(data.projects))throw Error(`Invalid historical catalogue for ${year}.`);
  for(const p of data.projects)if(p.kind==='TV series')originalSeries.set(p.id,p);
  let imported=attachFranchises(data.projects,franchiseData);
  if(seasonIndex.years?.includes(year)){
   const seasons=await readCatalogueResponse(await fetch(`./data/tv-seasons/years/${year}.json.gz`),true);
   imported=attachSeasons(imported,seasonIndex,seasons.projects);
  }
  if(filmographyIndex.years.includes(year)){
   const additions=await readCatalogueResponse(await fetch(`./data/filmographies/years/${year}.json.gz`),true);
   imported=mergeCatalogue(imported,attachFranchises(additions.projects,franchiseData));
  }
  const history=await readCatalogueResponse(await fetch(`./data/casting-history/years/${year}.json.gz`),true);
  for(const p of imported)p.incumbents=history.projects[p.id]||{};
  catalogue=mergeCatalogue(catalogue,imported);
  if(state){
   const titles=new Set(state.usedTitles),names=new Set(state.usedPeople);
   for(const project of imported){titles.add(project.title);for(const name of [project.director,...project.roles.map(r=>r.actor)])if(name)names.add(name)}
   state.usedTitles=[...titles];state.usedPeople=[...names]
  }
  loadedYears.add(year)
 })();
 loadingYears.set(year,pending);
 try{await pending}finally{loadingYears.delete(year)}
}
function compactNameRegistry(career){
 const names=new Set(career.people.map(p=>p.name)),titles=new Set(career.filmography.map(f=>f.title));
 for(const project of [...catalogue,...career.projects]){titles.add(project.title);if(project.director)names.add(project.director);for(const r of project.roles)if(r.actor)names.add(r.actor)}
 career.usedPeople=[...names];career.usedTitles=[...titles]
}
async function loadCareerYears(career){
 ensureCareer(career);
 const pending=career.filmography.filter(f=>f.personId===career.activeId&&f.status&&f.status!=='released'&&f.status!=='withdrawn');
 const pendingIds=new Set(pending.map(f=>f.projectId));
 const activeChoices=[...pendingOffers(career),...pendingAuditions(career)];
 const coming=career.contracts.filter(c=>c.personId===career.activeId&&c.status==='active').flatMap(c=>c.entries.filter(e=>['reserved','offered','booked'].includes(e.status)&&projectSchedule(e.project).castingStart<=new Date(Date.parse(currentDate(career)+'T12:00:00Z')+365*86400000).toISOString().slice(0,10)));
 const contractIds=new Set(coming.map(e=>e.project.id));
 const keep=new Set([career.year-1,career.year,career.year+1,career.year+2,...(career.applications||[]).filter(a=>a.personId===career.activeId&&['watching','considering','invited','callback','offered'].includes(a.status)).map(a=>a.year),...pending.map(f=>f.year),...activeChoices.map(o=>o.year),...coming.map(e=>e.project.year),...career.continuityRequests.filter(r=>r.year>=career.year-1&&r.year<=career.year+2).map(r=>r.year)]);
 catalogue=catalogue.filter(p=>keep.has(p.year)&&(!p.legacyOnly||pendingIds.has(p.id))&&(!p.contractOnly||contractIds.has(p.id)||pendingIds.has(p.id)));
 for(const year of loadedYears)if(!keep.has(year))loadedYears.delete(year);
 for(const year of keep)await loadYear(year);
 for(const [id,p] of originalSeries)if(!keep.has(p.year))originalSeries.delete(id);
 const showIds=new Set([...career.tvCareers.filter(c=>c.personId===career.activeId&&(c.status==='active'||c.status==='left'&&!c.departureResolved)).map(c=>c.seriesId),...career.filmography.filter(f=>f.personId===career.activeId&&f.kind==='TV series'&&!f.tvCareerId).map(f=>f.seriesId||f.projectId)]);
 for(const id of Object.keys(seasonShows))if(!showIds.has(id))delete seasonShows[id];
 for(const id of showIds){if(!seasonShows[id]&&seasonIndex.shows[id])seasonShows[id]=await readCatalogueResponse(await fetch(`./data/${filmographyIndex.shows[id]?'filmographies':'tv-seasons'}/shows/${id}.json.gz`),true)}
 // Retrieve only ongoing bookings omitted by the new selection, preserving old saves.
 for(const credit of pending){const p=originalSeries.get(credit.projectId);if(p&&!catalogue.some(p=>p.id===credit.projectId))catalogue=mergeCatalogue(catalogue,[{...p,legacyOnly:true}])}
 const present=new Set([...catalogue,...career.projects].map(p=>p.id));
 let missing=pending.filter(f=>!present.has(f.projectId));
 for(const credit of missing.filter(f=>franchiseData.projectCollections?.[f.projectId])){
  const response=await fetch(`./data/franchise-projects/${credit.projectId}.json.gz`);
  if(!response.ok)continue;
  const data=await readCatalogueResponse(response,true);if(data.project?.id!==credit.projectId)throw Error('Invalid booked franchise production.');
  catalogue=mergeCatalogue(catalogue,attachFranchises([{...data.project,legacyOnly:true}],franchiseData));present.add(credit.projectId)
 }
 missing=missing.filter(f=>!present.has(f.projectId));
 for(const year of new Set(missing.map(f=>f.year))){
  if(!dbMeta.archive)continue;
  const needed=new Set(missing.filter(f=>f.year===year).map(f=>f.projectId));
  const response=await fetch(`./${dbMeta.archive.path}/${year}.json.gz`);
  const data=await readCatalogueResponse(response,true);
  catalogue=mergeCatalogue(catalogue,data.projects.filter(p=>needed.has(p.id)).map(p=>({...p,legacyOnly:true})))
 }
 for(const entry of coming){
  if([...catalogue,...career.projects].some(p=>p.id===entry.project.id))continue;
  const response=await fetch(`./data/franchise-projects/${entry.project.id}.json.gz`);
  const data=await readCatalogueResponse(response,true);if(data.project?.id!==entry.project.id)throw Error('Invalid franchise production.');
  catalogue=mergeCatalogue(catalogue,attachFranchises([{...data.project,contractOnly:true}],franchiseData))
 }
 for(const request of career.continuityRequests.filter(r=>!r.seriesId&&r.year<=career.year+2)){
  if([...catalogue,...career.projects].some(p=>p.id===request.projectId))continue;
  const response=await fetch(`./data/franchise-projects/${request.projectId}.json.gz`);
  if(response.ok){const data=await readCatalogueResponse(response,true);catalogue=mergeCatalogue(catalogue,[{...data.project,contractOnly:true}])}
 }
 migrateSeriesCareers(career,catalogue,seasonShows);
 materializeReturns(career,catalogue);
 compactNameRegistry(career)
 if(career.overhaulVersion)syncCalendar(career,[...catalogue,...career.projects],projectSchedule)
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(y,m)=>new Date(Date.UTC(y,m-1,1)).toLocaleString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
const fmtDate=d=>new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const ageNow=s=>ageAt(s.birthday,s.year,s.month,Number(currentDate(s).slice(8)));
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const roleCredit=r=>r.roleType?`${esc(r.roleType)} · ${Number(r.episodeCount||0)} credited episodes · `:'';
function worldContinuity(p){
 const changed=state.showChanges?.[p.seriesId];
 if(changed?.status==='cancelled'&&p.seasonNumber>changed.afterSeason)return '<p class="notice">Cancelled in this timeline: this season does not proceed.</p>';
 if(p.alternateSeason||p.alternateCasting)return '<p class="notice">An alternate-timeline production or character appearance.</p>';
 return ''
}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch(e){toast('Storage full. Export your save in Settings.')}}
function toast(t){document.querySelector('.toast')?.remove();const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),2800)}
function action(fn){try{fn();save();render()}catch(e){toast(e.message)}}
function modal(html){const e=document.createElement('div');e.className='modal';e.innerHTML=`<div>${html}<button class="secondary" data-close>Close</button></div>`;document.body.append(e);e.addEventListener('click',x=>{if(x.target===e||x.target.closest('[data-close]'))e.remove()});return e}
function cardTimeline(t){return `<div class="card"><span class="eyebrow">${esc(t.date?fmtDate(t.date):fmt(t.year,t.month||1))}</span><h3>${esc(t.title)}</h3><p>${esc(t.body)}</p></div>`}
function databaseStatus(){
 const years=[...yearIndex].sort((a,b)=>a-b),totals=dbMeta.totals||{};
 if(dbMeta.selection)return `Selected historical catalogue: 1960–2026 · up to ${dbMeta.selection.filmLimit} films and ${dbMeta.selection.tvLimit} new TV shows per year · ${Number(totals.projects||0).toLocaleString()} productions · ${Number(totals.roles||0).toLocaleString()} credited roles.`;
 if(years.length>=67&&years[0]===1960&&years.at(-1)===2026)return `Full historical database installed: 1960–2026 · ${Number(totals.projects||0).toLocaleString()} productions · ${Number(totals.roles||0).toLocaleString()} credited roles.`;
 if(years.length)return `Historical database partly installed: ${years.length} year shard${years.length===1?'':'s'} available. Missing years still fall back to the demonstration catalogue where possible.`;
 return 'Historical database has not been imported yet, so this build is currently using the demonstration catalogue.'
}
function opportunityMarkup(birthday,gender,startDate){
 let date;try{date=careerStartDate({birthday,startDate})}catch(e){return esc(e.message)}
 const birthYear=Number(birthday.slice(0,4)),start=Number(date.slice(0,4)),byYear={};
 for(let year=start;year<start+6;year++){
  const actorAge=year-birthYear,indexed=opportunityIndex?.[String(year)]?.[normaliseGender(gender)]?.[String(actorAge)];
  byYear[year]=indexed??0
 }
 const total=Object.values(byYear).reduce((a,b)=>a+b,0),years=Object.entries(byYear).map(([year,count])=>`${year}: ${count}`).join(' · ');
 return `<strong>Approximately ${total.toLocaleString()} suitable roles</strong> begin casting across your first six playable years.<br><span class="muted">${esc(years)} · These preview counts cover films and series launches; additional season roles appear during play. Availability also depends on the date and your bookings.</span>`
}
function introV2(){
 nav.hidden=true;
 const defaultBirthday='1980-06-15',defaultGender='male',defaultStart=careerStartDate({birthday:defaultBirthday});
 screen.innerHTML=`<section class="hero"><div class="eyebrow">A life. A career. A changing world.</div><h1>Become part of cinema history.</h1><p>Begin in childhood or start your acting career later. Choose when your story opens.</p></section><form id="new"><div class="card"><div class="eyebrow">New life</div><label for="name">Your actor's name</label><input id="name" name="name" required maxlength="60" placeholder="Lewis Parry"><label for="birthday">Date of birth</label><input id="birthday" name="birthday" type="date" min="1900-01-01" max="2100-12-31" value="${defaultBirthday}" required><label for="startDate">Starting date</label><input id="startDate" name="startDate" type="date" min="1960-01-01" max="2199-12-31" value="${defaultStart}" required><div class="grid"><button type="button" class="outline" id="startChild">Start at age four</button><button type="button" class="outline" id="startAdult">Start at age eighteen</button></div><p class="muted" id="birthHint"></p><label for="gender">Gender</label><select name="gender" id="gender" required><option value="male">Male</option><option value="female">Female</option><option value="nonbinary">Non-binary</option></select><div class="notice" id="opportunityPreview"></div><label for="background">Family background</label><select name="background" id="background"><option value="ordinary">Ordinary household</option><option value="industry">Entertainment family</option></select><button type="submit" class="primary">Begin life</button></div></form><div class="notice">${esc(databaseStatus())}</div>`;
 let customStart=false;
 const update=()=>{
  const birthday=$('#birthday').value,startDate=$('#startDate').value;
  try{const date=careerStartDate({birthday,startDate});$('#startDate').setCustomValidity('');$('#birthHint').textContent=`Your story begins ${fmtDate(date)}, at age ${ageAt(birthday,Number(date.slice(0,4)),Number(date.slice(5,7)),Number(date.slice(8)))}.`}
  catch(e){$('#startDate').setCustomValidity(e.message);$('#birthHint').textContent=e.message}
  $('#opportunityPreview').innerHTML=opportunityMarkup(birthday,$('#gender').value,startDate)
 };
 const setAge=age=>{const birthday=$('#birthday').value;if(!birthday)return;const date=new Date(`${birthday}T12:00:00Z`);if(Number.isNaN(date.getTime()))return;date.setUTCFullYear(date.getUTCFullYear()+age);$('#startDate').value=date.toISOString().slice(0,10);update()};
 $('#birthday').oninput=()=>{if(!customStart)setAge(4);else update()};
 $('#startDate').oninput=()=>{customStart=true;update()};$('#gender').onchange=update;
 $('#startChild').onclick=()=>{customStart=false;setAge(4)};$('#startAdult').onclick=()=>{customStart=true;setAge(18)};update();
 $('#new').onsubmit=async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));const button=e.target.querySelector('button[type=submit]');try{const date=careerStartDate(values),year=Number(date.slice(0,4));button.disabled=true;button.textContent='Loading historical productions…';catalogue=catalogue.filter(p=>p.generated);loadedYears.clear();for(const y of [year-1,year,year+1,year+2])await loadYear(y);state=createCareer(values,catalogue);migrateOverhaul(state,catalogue);auditionQuery='';auditionPageNumber=0;peoplePage=0;tab='home';save();render()}catch(err){toast(err.message);button.disabled=false;button.textContent='Begin life'}}
}
function shortlistMarkup(list){return list.map(c=>`<div class="row"><span>${c.player?'<strong>You</strong>':esc(c.name)}${c.original?' <span class="muted">(historical choice)</span>':''}<br><span class="muted">${esc(genderLabel(c.gender))}</span></span><span class="pill">${c.fit}% fit</span></div>`).join('')}
function homeV2(){
 ensureCareer(state);const p=active(state),age=ageNow(state),date=currentDate(state),needsGender=normaliseGender(p.gender)==='unspecified',offers=needsGender?[]:available(state,catalogue),event=state.notifications[0],shoots=filmingProjects(state,catalogue);
 const page=auditionPage(offers,{query:auditionQuery,kind:auditionKind,page:auditionPageNumber});auditionPageNumber=page.page;
 screen.innerHTML=`<section class="hero"><div class="eyebrow">Week of ${esc(fmtDate(date))} · Age ${age}</div><h1>${esc(p.name)}</h1><p>${age<18?'A childhood still unfolding.':'Your own version of Hollywood is taking shape.'}</p><div class="row"><span class="tag">${age<18?'Childhood':state.fame>70?'Global star':state.fame>35?'Rising star':'Working actor'}</span><span>${money(state.money)}</span></div></section>
 ${state.socialInvitations.some(e=>e.personId===state.activeId)?'<div class="notice">Someone wants to talk about your relationship. Open People to answer their invitation.</div>':''}
 ${state.complete?'<div class="notice">This life has ended. Open Legacy to read the retrospective, or start a new life in Settings.</div>':''}
 ${needsGender?'<div class="card"><div class="eyebrow">Casting profile</div><h2>Choose this character’s gender</h2><p>Your old save predates gender-aware casting. Pick one once so compatible auditions appear.</p><div class="grid"><button class="secondary" data-set-gender="male">Male</button><button class="secondary" data-set-gender="female">Female</button><button class="secondary" data-set-gender="nonbinary">Non-binary</button></div></div>':''}
 ${event?`<div class="card"><div class="eyebrow">A moment in your life</div><h2>${esc(event.title)}</h2><p>${esc(event.body)}</p><div class="grid"><button class="primary" data-event="engage">Engage</button><button class="secondary" data-event="pass">Pass</button></div></div>`:''}
 <div class="grid"><div class="stat"><span>Fame</span><b>${state.fame}/100</b></div><div class="stat"><span>Acting</span><b>${state.skills.acting}/100</b></div><div class="stat"><span>Health</span><b>${state.health}/100</b></div><div class="stat"><span>Booked roles</span><b>${state.filmography.filter(f=>f.personId===p.id).length}</b></div></div>
 ${careerHubMarkup(state,catalogue,franchiseData,{esc,money,fmtDate})}
 ${shoots.map(project=>{const t=projectSchedule(project);return `<div class="card"><span class="eyebrow">On set · ${esc(project.kind)}</span><h2>${esc(project.title)}</h2><p>Filming until about ${esc(fmtDate(t.filmingEnd))}. ${project.roles.length} credited cast members in World.</p><button class="secondary" data-tab-link="people">Spend time with castmates</button><button class="outline" data-set-action="rehearse" data-project="${esc(project.id)}">Rehearse scenes</button><button class="outline" data-set-action="teamwork" data-project="${esc(project.id)}">Support castmates</button><button class="outline" data-set-action="rest" data-project="${esc(project.id)}">Rest between takes</button></div>`}).join('')}
 <div class="row" style="margin-top:24px"><h2 style="font-family:Georgia,serif">Auditions</h2><span class="pill">${offers.length.toLocaleString()} suitable</span></div>
 <div class="card"><label for="auditionSearch">Search suitable auditions</label><input id="auditionSearch" value="${esc(auditionQuery)}" placeholder="Film, show, character, actor or director"><label for="auditionKind">Production type</label><select id="auditionKind"><option value="" ${!auditionKind?'selected':''}>Films and TV shows</option><option value="Film" ${auditionKind==='Film'?'selected':''}>Films</option><option value="TV series" ${auditionKind==='TV series'?'selected':''}>TV shows</option></select><div class="row"><span class="pill">${page.total.toLocaleString()} matching</span><span class="muted">Page ${page.page+1} of ${page.pages}</span></div><p class="muted">Every matching role is available across these pages. TV cards show the specific season. Minimum fit: 35%, with compatible gender and an undecided role. Auditions appear while casting is open. Shoots must fit around your existing bookings. Production dates are estimates.</p></div>${page.offers.length?page.offers.map(({project:r,role,index,fit})=>`<div class="card"><div class="row"><span class="eyebrow">${esc(r.kind)} · Audition closes ${esc(fmtDate(projectSchedule(r).castingEnd))}</span><span class="tag">${fit}% fit</span></div><h2>${esc(r.title)}</h2><p><strong>${esc(role.character)}</strong> · ${esc(genderLabel(role.gender))} · ${roleCredit(role)}Playing age ${role.characterAge??`${role.ageMin}–${role.ageMax}`}<br>${esc(r.creditLabel||'Directed by')}: ${esc(directorFor(state,r))}</p><p class="muted">Estimated filming ${esc(fmtDate(projectSchedule(r).filmingStart))}–${esc(fmtDate(projectSchedule(r).filmingEnd))} · Release ${esc(fmtDate(projectSchedule(r).releaseDate))}</p><p class="muted">Preparation ${preparation(state,r,index)}/60${r.collectionId?' · Linked franchise':''}</p><button class="outline" data-prepare="${esc(r.id)}" data-index="${index}" data-kind="script">Rehearse script</button><button class="outline" data-prepare="${esc(r.id)}" data-index="${index}" data-kind="coach">Paid coaching</button><button class="secondary" data-shortlist="${esc(r.id)}" data-index="${index}">View shortlist</button><button class="primary" data-audition="${esc(r.id)}" data-index="${index}">Attend audition</button><button class="outline" data-force-audition="${esc(r.id)}" data-index="${index}">Force win (cheat)</button></div>`).join(''):`<div class="card"><p>${needsGender?'Choose your character’s gender above to enable gender-correct casting.':offers.length?'No suitable auditions match this search. Try a different search or production type.':'No roles casting this year currently meet both the gender rule and the minimum 35% playing-age fit. Open <strong>World</strong> to see the productions continuing around you.'}</p></div>`}<div class="grid"><button class="secondary" id="auditionPrev" ${page.page===0?'disabled':''}>← Previous auditions</button><button class="secondary" id="auditionNext" ${page.page>=page.pages-1?'disabled':''}>Next auditions →</button></div>
 <div class="card"><div class="eyebrow">Time moves forward</div><h2>What next?</h2><p class="muted">${state.energy??100}/100 energy. Practice and on-set activities use 15. Rest recovers energy and advances one week.</p><div class="grid"><button class="secondary" data-train="acting">Practice acting</button><button class="secondary" data-train="drama">Practice drama</button><button class="secondary" data-life="rest">Rest</button><button class="secondary" data-life="fitness">Exercise</button>${age>=18?'<button class="secondary" data-life="nightout">Go out · $100</button>':''}</div><button class="primary" data-advance="1">Next week →</button><button class="secondary" data-advance="4">Advance four weeks</button></div>
 <h2 style="font-family:Georgia,serif">Life & money</h2><div class="card"><p>Spend what your career earns. Purchases become part of your story.</p><p class="muted">Owned: ${esc((state.possessions||[]).filter(x=>x.ownerId===p.id).map(x=>x.name).join(', ')||'Nothing yet')}</p>${shop.filter(x=>age>=x.minAge).map(x=>`<button class="secondary" data-buy="${x.id}">Buy ${esc(x.name)} · ${money(x.price)}</button>`).join('')}</div><h2 style="font-family:Georgia,serif">Recent history</h2><div class="timeline">${state.timeline.slice(0,3).map(cardTimeline).join('')}</div>`;
 $('#auditionSearch').oninput=e=>{const pos=e.target.selectionStart;auditionQuery=e.target.value;auditionPageNumber=0;homeV2();const input=$('#auditionSearch');input.focus();input.setSelectionRange(pos,pos)};
 $('#auditionKind').onchange=e=>{auditionKind=e.target.value;auditionPageNumber=0;homeV2()};
 $('#auditionPrev').onclick=()=>{auditionPageNumber--;homeV2()};
 $('#auditionNext').onclick=()=>{auditionPageNumber++;homeV2()};
 screen.querySelectorAll('[data-shortlist]').forEach(b=>b.onclick=()=>{const offer=offers.find(x=>x.project.id===b.dataset.shortlist&&x.index===Number(b.dataset.index));if(offer)modal(`<h2>${esc(offer.project.title)}</h2><p>${esc(offer.role.character)}</p>${shortlistMarkup(auditionShortlist(state,catalogue,offer.project,offer.role,offer.index))}`)});
 screen.querySelectorAll('[data-set-gender]').forEach(b=>b.onclick=()=>action(()=>{p.gender=b.dataset.setGender}));
 screen.querySelectorAll('[data-audition],[data-force-audition]').forEach(b=>b.onclick=()=>{const offer=offers.find(x=>x.project.id===(b.dataset.audition||b.dataset.forceAudition)&&x.index===Number(b.dataset.index));if(!offer)return;let outcome;action(()=>{outcome=startAudition(state,catalogue,offer.project,offer.index,{forceWin:Boolean(b.dataset.forceAudition)})});if(outcome)modal(`<div class="eyebrow">Audition result</div><h2>${outcome.stage==='offer'?'You have the offer.':outcome.stage==='callback'?'You have a callback.':'Not this time.'}</h2><p>${outcome.stage==='offer'?'Review the fee and filming dates under Offers to consider. Accept the role alone or choose an available multi-film deal.':outcome.stage==='callback'?'Your callback appears above. You can prepare before the final decision.':'You were not shortlisted for the next round. Other opportunities will follow.'}</p>`)});
 screen.querySelectorAll('[data-prepare]').forEach(b=>b.onclick=()=>action(()=>{const offer=offers.find(o=>o.project.id===b.dataset.prepare&&o.index===Number(b.dataset.index));if(offer)prepareAudition(state,catalogue,offer.project,offer.index,b.dataset.kind)}));
 screen.querySelectorAll('[data-set-action]').forEach(b=>b.onclick=()=>action(()=>onSetAction(state,catalogue,b.dataset.project,b.dataset.setAction)));

 screen.querySelectorAll('[data-tab-link]').forEach(b=>b.onclick=()=>{tab=b.dataset.tabLink;render()});
 screen.querySelectorAll('[data-train]').forEach(b=>b.onclick=()=>action(()=>train(state,b.dataset.train)));
 screen.querySelectorAll('[data-life]').forEach(b=>b.onclick=async()=>{try{lifestyle(state,b.dataset.life);if(b.dataset.life==='nightout')meetSomeone(state,'community');save();render();if(['rest','nightout'].includes(b.dataset.life))await advanceWeeks(1)}catch(e){toast(e.message)}});
 screen.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>action(()=>buy(state,b.dataset.buy)));
 screen.querySelectorAll('[data-advance]').forEach(b=>b.onclick=()=>advanceWeeks(Number(b.dataset.advance)));
 screen.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>action(()=>eventChoice(state,event,b.dataset.event)));
 bindCareerHub(screen,{state,catalogue,data:franchiseData,action,save,render,loadCareerYears,toast,modal})
}
function world(){
 const all=worldProjects(state,catalogue),q=worldQuery.trim().toLowerCase();
 const filtered=q?all.filter(p=>[p.title,p.director,p.genre,...p.roles.flatMap(r=>[r.character,r.actor]),...(p.crew||[]).flatMap(c=>[c.name,c.job])].some(v=>String(v||'').toLowerCase().includes(q))):all;
 const pageSize=30,pages=Math.max(1,Math.ceil(filtered.length/pageSize));worldPage=Math.min(worldPage,pages-1);
 const projects=filtered.slice(worldPage*pageSize,(worldPage+1)*pageSize);
 screen.innerHTML=`<div class="eyebrow">Living Hollywood</div><h1 style="font-family:Georgia,serif">The production world</h1><p class="muted">Every listed cast reflects this save. A changed name means history has already diverged. Search by production, character, cast or crew.</p><div class="card"><label for="worldSearch">Search loaded productions</label><input id="worldSearch" value="${esc(worldQuery)}" placeholder="Film, series, actor, character, crew"><div class="row"><span class="pill">${filtered.length.toLocaleString()} matching</span><span class="muted">Page ${worldPage+1} of ${pages}</span></div></div>${projects.map(p=>`<div class="card"><div class="row"><span class="eyebrow">${esc(projectPhase(state,p))} · ${esc(p.kind)}</span><span class="tag">${p.year}</span></div><h2>${esc(p.title)}</h2>${worldContinuity(p)}<p>${esc(p.genre)} · ${esc(p.creditLabel||'Directed by')} ${esc(directorFor(state,p))}<br><span class="muted">${projectSchedule(p).estimated?'Estimated shoot':'Shoot'} ${esc(fmtDate(projectSchedule(p).filmingStart))}–${esc(fmtDate(projectSchedule(p).filmingEnd))} · Release ${esc(fmtDate(projectSchedule(p).releaseDate))}</span></p>${state.productionOutcomes[p.id]?`<p class="notice">Your timeline: ${esc(state.productionOutcomes[p.id].result)} · performance ${state.productionOutcomes[p.id].performance}/100.</p>`:''}${state.worldChanges?.some(c=>c.projectId===p.id)?`<p class="muted">Casting history changed in this save: ${state.worldChanges.filter(c=>c.projectId===p.id).length} role(s).</p>`:''}<div class="line"></div>${p.roles.map((r,i)=>`<div class="row" style="align-items:flex-start;margin:8px 0"><span><strong>${esc(r.character)}</strong> · <span class="muted">${esc(genderLabel(r.gender))}</span><br><span class="muted">${esc(castFor(state,p,i))}${castFor(state,p,i)!==r.actor?` · originally ${esc(r.actor)}`:''}</span></span><span class="pill">Your fit ${roleFit(state,p,r)}%</span></div>`).join('')}${p.crew?.length?`<details><summary>${p.crew.length} crew credits</summary>${p.crew.map(c=>`<p class="muted">${esc(c.name)} · ${esc(c.job)}</p>`).join('')}</details>`:''}</div>`).join('')||'<div class="card"><p>No loaded projects match this search.</p></div>'}<div class="grid"><button class="secondary" id="worldPrev" ${worldPage===0?'disabled':''}>← Previous</button><button class="secondary" id="worldNext" ${worldPage>=pages-1?'disabled':''}>Next →</button></div>`;
 $('#worldSearch').oninput=e=>{const value=e.target.value,pos=e.target.selectionStart;worldQuery=value;worldPage=0;world();const input=$('#worldSearch');input?.focus();try{input?.setSelectionRange(pos,pos)}catch{}};
 $('#worldPrev').onclick=()=>{if(worldPage>0){worldPage--;world()}};
 $('#worldNext').onclick=()=>{if(worldPage<pages-1){worldPage++;world()}}
}
function career(){
 const p=active(state),credits=state.filmography.filter(f=>f.personId===p.id).sort((a,b)=>b.year-a.year),projects=new Map([...catalogue,...state.projects].map(x=>[x.id,x]));
 screen.innerHTML=`<div class="eyebrow">Career</div><h1 style="font-family:Georgia,serif">Your productions</h1><p class="muted">A booked role becomes a shoot, then a release. Historical timing without a supplied filming date is estimated.</p><div class="grid"><div class="stat"><span>Roles won</span><b>${credits.length}</b></div><div class="stat"><span>Released</span><b>${credits.filter(f=>!f.status||f.status==='released').length}</b></div><div class="stat"><span>Industry respect</span><b>${state.respect}</b></div><div class="stat"><span>Acting skill</span><b>${state.skills.acting}</b></div></div>${awardsMarkup(state,{esc,fmtDate})}${careerHubMarkup(state,catalogue,franchiseData,{esc,money,fmtDate,history:true})}${credits.map(f=>{const t=projects.has(f.projectId)?projectSchedule(projects.get(f.projectId)):null;return `<div class="card"><span class="eyebrow">${f.year} · ${esc(f.kind)} · ${esc(f.status||'Released')}</span><h2>${esc(f.title)}</h2><p>As ${esc(f.role)} · ${esc(f.director)}</p>${t?`<p class="muted">${t.estimated?'Estimated filming':'Filming'} ${esc(fmtDate(t.filmingStart))}–${esc(fmtDate(t.filmingEnd))} · Release ${esc(fmtDate(t.releaseDate))}</p>`:''}${f.outcome?`<p class="notice">${esc(f.outcome.result)} · performance ${f.outcome.performance}/100 · audience reception ${f.outcome.reception}/100.</p>`:''}<p class="muted">Original performer: ${esc(f.original)}${f.agentCommission?` · Agent commission ${Math.round(f.agentCommission*100)}%`:''}</p></div>`}).join('')||'<div class="card"><p>Your first role is still ahead of you.</p></div>'}<h2 style="font-family:Georgia,serif">World timeline</h2>${state.timeline.slice(0,25).map(cardTimeline).join('')}`;
 bindCareerHub(screen,{state,catalogue,data:franchiseData,action,save,render,loadCareerYears,toast,modal})
}
function people(){ensureRelationships(state);renderRelationships(screen,{state,catalogue,esc,fmtDate,save,render,toast,advanceWeeks})}
let advancing=false;
async function advanceWeeks(count,{resume=false}={}){
 if(advancing)return;
 if(openLifeEvent(state)){toast('Answer the current event before advancing time.');presentEvent(uiContext());return}
 advancing=true;let remaining=resume?state.advanceRemaining:count*7;state.advanceRemaining=0;
 try{
  while(remaining>0&&!state.complete){
   const date=currentDate(state),end=plusDays(date,Math.min(7,remaining));
   if(Number(end.slice(0,4))!==state.year)await loadCareerYears({...state,year:Number(end.slice(0,4))});
   let next=nextScheduledDate(state,end);
   const dates=[...state.applications.filter(a=>a.personId===state.activeId&&['watching','considering','invited','callback'].includes(a.status)).flatMap(a=>[a.readyOn,a.expiresOn]),...state.careerAuditions.filter(a=>a.personId===state.activeId&&a.status==='callback').map(a=>a.readyOn),...state.filmography.filter(f=>f.personId===state.activeId&&!['released','withdrawn'].includes(f.status)).flatMap(f=>{const p=[...catalogue,...state.projects].find(p=>p.id===f.projectId);return p?[projectSchedule(p).filmingStart,projectSchedule(p).filmingEnd,projectSchedule(p).releaseDate]:[]}),...state.awards.filter(a=>a.personId===state.activeId&&a.status==='nominated').map(a=>a.ceremonyDate)];
   for(const d of dates)if(d>date&&d<next)next=d;
   const days=Math.max(1,daysBetween(date,next));
   advance(state,catalogue,{days});careerTick(state,catalogue,franchiseData);
   continuityTick(state,catalogue,{shows:seasonShows,franchises:franchiseData,overrides:continuityOverrides});
   overhaulTick(state,catalogue);remaining-=days;
   if(state.continuityRequests.some(r=>![...catalogue,...state.projects].some(p=>p.id===r.projectId)&&r.year<=state.year+2))await loadCareerYears(state);
   if(openLifeEvent(state)){state.advanceRemaining=Math.max(0,remaining);break}
  }
  save();render();
 }catch(err){state.advanceRemaining=Math.max(0,remaining);save();render();toast(err.message)}finally{advancing=false}
}

function legacy(){const p=active(state),family=state.people.filter(x=>x.relative&&x.id!==p.id),notices=state.deathNotices;screen.innerHTML=`<div class="eyebrow">The family story</div><h1 style="font-family:Georgia,serif">Legacy</h1><div class="card"><h2>${esc(p.name)}</h2><p>Born ${esc(state.birthday)} · ${esc(genderLabel(p.gender))} · ${esc(p.occupation)} · ${p.alive?'Living':'Deceased'}</p><p>${state.filmography.filter(f=>f.personId===p.id).length} credited projects in this timeline.</p></div><h2 style="font-family:Georgia,serif">Family</h2>${family.map(f=>`<div class="card"><div class="row"><h3>${esc(f.name)}</h3><span class="tag">${esc(f.relative)}</span></div><p>Born ${f.birthYear} · ${esc(genderLabel(f.gender))} · ${esc(f.occupation)} · ${f.alive?'Living':'Remembered'}</p>${state.children.includes(f.id)&&f.alive&&state.year-f.birthYear>=4?`<button class="outline" data-switch="${esc(f.id)}">Continue as ${esc(f.name)}</button>`:''}</div>`).join('')}<div class="card"><h2>Next generation</h2><p>You can name a child, then switch to their life any time after their fourth birthday. Your former character stays in the world.</p><label for="childName">Child's name</label><input id="childName" placeholder="First and last name"><label for="childGender">Gender</label><select id="childGender"><option value="male">Male</option><option value="female">Female</option><option value="nonbinary">Non-binary</option></select><button class="secondary" id="childButton">Add a child to this timeline</button></div>${notices.length?`<h2 style="font-family:Georgia,serif">Memorials</h2>${notices.map(n=>`<div class="card"><span class="eyebrow">${n.year} · ${esc(n.medium)}</span><h2>${esc(n.headline)}</h2><p>${esc(n.body)}</p>${n.tributes.map(t=>`<p class="muted">${esc(t)}</p>`).join('')}<p class="muted">Career: ${esc(n.career.join(', ')||'No screen credits')}</p></div>`).join('')}`:''}`;$('#childButton').onclick=()=>action(()=>haveChild(state,$('#childName').value,$('#childGender').value));screen.querySelectorAll('[data-switch]').forEach(b=>b.onclick=()=>action(()=>{switchTo(state,b.dataset.switch);tab='home'}))}
function cheats(){
 if(!state)return toast('Start a life first.');
 const contacts=state.people.filter(p=>p.id!==state.activeId&&p.alive);
 const castmates=contacts.filter(p=>p.occupation==='Actor'&&state.relationships[p.name]).map(p=>p.name);
 const m=modal(`<div class="eyebrow">Your sandbox</div><h2>Cheats</h2><p>Set each skill or relationship level independently.</p><div class="grid"><button class="secondary" data-cheat="acting">Max acting</button><button class="secondary" data-cheat="drama">Max drama</button><button class="secondary" data-cheat="comedy">Max comedy</button></div><label for="cheatPerson">Relationship target</label><select id="cheatPerson"><option value="__castmates__">All known castmates (${castmates.length})</option>${contacts.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.relative?` · ${esc(p.relative)}`:''}</option>`).join('')}</select><div class="grid"><button class="secondary" data-cheat="friendship">Max friendship</button><button class="secondary" data-cheat="respect">Max professional respect</button><button class="secondary" data-cheat="chemistry">Max romantic chemistry</button></div><label><input type="checkbox" id="allowRecasting" ${state.allowRecasting?'checked':''}> Allow recasting established characters (separate cheat)</label><p class="muted">Force win stays available on eligible auditions. Recasting deliberately changes existing continuity.</p><p class="muted">Romantic chemistry follows dating eligibility: age 13+, close-age teenagers or two adults, and no relatives. Maxing chemistry does not start a relationship.</p><p class="notice" id="cheatResult" aria-live="polite">These changes are saved immediately.</p>`);
 m.querySelector('#allowRecasting').onchange=e=>{state.allowRecasting=e.target.checked;save();render()};
 m.querySelectorAll('[data-cheat]').forEach(b=>b.onclick=()=>{
  const target=m.querySelector('#cheatPerson').value,names=target==='__castmates__'?castmates:contacts.filter(p=>p.id===target).map(p=>p.name);
  try{const changed=applyCheat(state,b.dataset.cheat,names);save();render();m.querySelector('#cheatResult').textContent=['acting','drama','comedy'].includes(b.dataset.cheat)?`${b.dataset.cheat} is now 100.`:changed?`Updated ${changed} ${changed===1?'relationship':'relationships'}${b.dataset.cheat==='chemistry'?' · romantic chemistry is now 100':''}.`:b.dataset.cheat==='chemistry'?'No eligible matches selected. Chemistry starts at 13: teenagers must both be under 18 and within two years of each other. Adults must both be 18 or older. Relatives are excluded.':'No known castmates selected. Choose a person from the list.'}catch(e){toast(e.message)}
 })
}
function uiContext(){return {state,catalogue,esc,money,fmtDate,save,render,toast,action,modal,advanceWeeks,loadYear,navigate:next=>{tab=next;render();window.scrollTo(0,0)}}}
function render(){if(!state){introV2();return}ensureRelationships(state);ensureOverhaul(state);syncCalendar(state,[...catalogue,...state.projects],projectSchedule);nav.hidden=false;nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));nav.querySelector('[data-tab="people"]').textContent='People'+(state.socialInvitations.some(e=>e.personId===state.activeId)?' •':'');({home:()=>renderToday(screen,uiContext()),world:()=>renderWorld(screen,uiContext()),career,people,legacy}[tab]||(()=>renderToday(screen,uiContext())))();presentEvent(uiContext())}
nav.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;render();window.scrollTo(0,0)}});
$('#settingsButton').onclick=()=>{const m=modal(`<div class="eyebrow">Settings & credits</div><h2>Second Take</h2><p>Version 1.5 · save stored on this device. Export regularly to keep a backup. Importing replaces this device's current save.</p><div class="actions"><button class="primary" id="exportSave">Export save</button><label for="importSave">Import save (.json)</label><input id="importSave" type="file" accept="application/json,.json"><button class="secondary" id="openCheats">Cheats</button><button class="danger" id="resetSave">Start a new life</button></div><div class="line"></div><p class="muted">Historical catalogue: ${esc(databaseStatus())} All changed casting, relationships, and tributes are fictional. Independent fan-made project; unaffiliated with any film studio or the referenced management game.</p><a href="https://www.themoviedb.org/" target="_blank" rel="noopener" aria-label="The Movie Database"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg" alt="TMDB" style="width:140px;max-width:45%;height:auto;margin:8px 0"></a><p class="muted">This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</p>`);m.querySelector('#openCheats').onclick=()=>{m.remove();cheats()};m.querySelector('#exportSave').onclick=()=>{if(!state)return toast('Start a life first.');const u=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=`second-take-${state.year}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)};m.querySelector('#importSave').onchange=async e=>{try{const t=await e.target.files[0].text(),v=JSON.parse(t);if(v.version!==1||!Array.isArray(v.people)||!Array.isArray(v.timeline)||!v.activeId||!Number.isInteger(v.year))throw Error('This is not a compatible save.');await loadCareerYears(v);state=v;migrateOverhaul(state,catalogue);state.date??=currentDate(state);state.directors??={};state.possessions??=[];state.people.forEach(p=>p.gender??='unspecified');save();m.remove();render()}catch(err){toast(err.message)}};m.querySelector('#resetSave').onclick=()=>{if(!confirm('Replace this device’s current life? Export it first if you want to keep it.'))return;localStorage.removeItem(SAVE_KEY);state=null;m.remove();render()}};
async function init(){try{
 const response=await fetch('./data/sample.json?v=15');if(!response.ok)throw Error('Catalogue failed to load.');const sample=(await response.json()).projects;
 const manifest=await fetch('./data/years/index.json?v=15');if(!manifest.ok)throw Error('Historical database index could not load. Please try again online.');dbMeta=await manifest.json();yearIndex=new Set(dbMeta.years||[]);opportunityIndex=dbMeta.opportunities||{}
 const franchises=await fetch('./data/franchises.json.gz?v=15');franchiseData=await readCatalogueResponse(franchises,true);
 seasonIndex=await readCatalogueResponse(await fetch('./data/tv-seasons/index.json.gz?v=15'),true);
 const filmographies=await fetch('./data/filmographies/index.json?v=15');if(!filmographies.ok)throw Error('Permanent filmographies could not load. Please try again online.');filmographyIndex=await filmographies.json();
 seasonIndex={...seasonIndex,shows:{...seasonIndex.shows,...filmographyIndex.shows}};
 const overrides=await fetch('./data/continuity-overrides.json?v=15');if(!overrides.ok)throw Error('Character continuity could not load.');continuityOverrides=await overrides.json();
 catalogue=attachFranchises(sample.filter(p=>!yearIndex.has(p.year)),franchiseData);
 const raw=localStorage.getItem(SAVE_KEY);
 if(raw){
  const loaded=JSON.parse(raw);
  if(loaded.version===1&&Array.isArray(loaded.people)){
   state=loaded;state.date??=currentDate(state);state.directors??={};state.possessions??=[];state.people.forEach(p=>p.gender??='unspecified');
   await loadCareerYears(state);migrateOverhaul(state,catalogue);save()
  }
 }
 render();if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js?v=15').catch(()=>{})
}catch(e){screen.innerHTML=`<div class="card"><h2>Could not load the game</h2><p>${esc(e.message)}</p><p>Open from a local web server or GitHub Pages, rather than directly as a file.</p></div>`}}
init();
