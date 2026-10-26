import {SAVE_KEY,createCareer,ageAt,advance,switchTo,currentDate,projectSchedule,careerStartDate,applyCheat,normaliseGender} from './engine.js?v=16';
import {ensureCareer,attachFranchises,pendingOffers,pendingAuditions,careerTick} from './career.js?v=16';
import {readCatalogueResponse,mergeCatalogue} from './catalogue.js?v=16';
import {attachSeasons,migrateSeriesCareers,continuityTick,materializeReturns} from './continuity.js?v=16';
import {ensureRelationships} from './relationships.js?v=16';
import {renderRelationships} from './relationships-ui.js?v=16';
import {migrateOverhaul,overhaulTick,nextScheduledDate,resolveLifeEvent,guestEligible} from './overhaul.js?v=16';
import {ensureOverhaul,openLifeEvent,plusDays,daysBetween,syncCalendar,calendarReason} from './game-rules.js?v=16';
import {ensureLife,weeklyLife,conditionsOf} from './life.js?v=16';
import {spinoffTick} from './spinoffs.js?v=16';
import {renderTopbar,renderDock,renderLife,renderCareer,setCareerSeg,renderAssets,renderActivities,renderLegacy,attentionCount} from './ui-life.js?v=16';
const $=s=>document.querySelector(s),screen=$('#screen'),nav=$('#nav');let catalogue=[],state=null,tab='life',yearIndex=new Set(),loadedYears=new Set(),opportunityIndex={},dbMeta={},worldQuery='',worldPage=0,auditionQuery='',auditionKind='',auditionPageNumber=0;
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
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
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
function databaseStatus(){const totals=dbMeta.totals||{};if(dbMeta.selection)return `Film history 1960–2026: ${Number(totals.projects||0).toLocaleString()} productions and ${Number(totals.roles||0).toLocaleString()} credited roles.`;const years=[...yearIndex];return years.length?`${years.length} years of film history installed.`:'Using the demonstration catalogue.'}
const topbar=$('#topbar'),dock=$('#dock');
function showResult(title,body,icon='',after=null){
 const e=document.createElement('div');e.className='modal result-modal';e.setAttribute('role','dialog');e.setAttribute('aria-modal','true');
 e.innerHTML=`<div class="result-sheet">${icon?`<div class="sheet-kicker"><span class="emoji">${icon}</span></div>`:''}<h2>${esc(title)}</h2>${body?`<p>${esc(body)}</p>`:''}<div class="sheet-actions"><button class="primary" data-ok>OK</button></div></div>`;
 document.body.append(e);const close=()=>{e.remove();if(after)after();else render()};
 e.querySelector('[data-ok]').onclick=close;e.addEventListener('click',x=>{if(x.target===e)close()});e.querySelector('[data-ok]').focus();
}
const eventIcon={casting:'🎬',offer:'📜',release:'🎞️','award-invitation':'🏆','award-result':'🏆',work:'🎥',publicity:'📺',rumour:'📰',relationship:'💞',friendship:'🤝',rivalry:'⚔️',recast:'🔁',budget:'💸',life:'✨',health:'🩺',family:'👪',legacy:'🕯️'};
const eventKicker={casting:'Casting',offer:'An offer',release:'Release',  'award-invitation':'Awards','award-result':'Awards',work:'On set',publicity:'Publicity',rumour:'Gossip',relationship:'Love life',friendship:'Friends',rivalry:'Rivalry',recast:'Casting',budget:'Money',life:'Life',health:'Health',family:'Family',legacy:'The end'};
function presentEventSheet(){
 const s=state,e=s&&openLifeEvent(s),existing=document.querySelector('.life-event-modal');
 if(document.querySelector('.result-modal'))return;
 if(!e){existing?.remove();return}if(existing?.dataset.eventId===e.id)return;existing?.remove();
 const m=document.createElement('div');m.className='modal life-event-modal';m.dataset.eventId=e.id;m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','lifeEventTitle');
 const guest=e.type==='award-invitation',guests=guest?s.people.filter(p=>guestEligible(s,p,e.data.ceremonyDate)):[];
 const when=e.data.ceremonyDate||e.data.appearanceDate,clash=when?calendarReason(s,when,plusDays(when,1)):'';
 m.innerHTML=`<div><div class="sheet-kicker"><span class="emoji">${eventIcon[e.type]||'✨'}</span><span>${esc(eventKicker[e.type]||'Life')} · ${esc(fmtDate(e.date))}</span></div><h2 id="lifeEventTitle">${esc(e.title)}</h2><p class="event-copy">${esc(e.body)}</p>${guest?`<label for="awardGuest">Bring a guest</label><select id="awardGuest"><option value="">Choose someone</option>${guests.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${s.relationships[p.name]?.dating?' · partner':p.relative?' · family':' · friend'}</option>`).join('')}</select>`:''}${clash?`<p class="notice">${esc(clash)}</p>`:''}<div class="event-options">${e.options.map((o,i)=>`<button class="${i===0?'primary':'secondary'}" data-life-answer="${esc(o.id)}" ${clash&&['attend','alone','guest'].includes(o.id)?'disabled':''}>${esc(o.label)}</button>`).join('')}</div>${s.advanceRemaining&&e.type!=='legacy'?`<p class="muted" style="margin-top:10px">Time is paused. ${s.advanceRemaining} days of your skip remain.</p>`:''}<p class="notice" id="eventError" hidden></p></div>`;
 document.body.append(m);
 m.querySelectorAll('[data-life-answer]').forEach(b=>b.onclick=async()=>{
  let outcome='';try{outcome=resolveLifeEvent(s,catalogue,e.id,b.dataset.lifeAnswer,{guestId:m.querySelector('#awardGuest')?.value||null})}catch(err){const box=m.querySelector('#eventError');box.hidden=false;box.textContent=err.message;return}
  save();m.remove();
  if(e.type==='offer'&&b.dataset.lifeAnswer==='accept')await loadCareerYears(state);
  const resume=()=>{render();if(!openLifeEvent(state)&&state.advanceRemaining&&!state.complete)advanceWeeks(0,{resume:true})};
  if(outcome)showResult(e.title,outcome,eventIcon[e.type]||'✨',resume);else resume();
 });
 m.querySelector('button')?.focus();
}
function intro(){
 nav.hidden=true;topbar.hidden=true;dock.hidden=true;screen.className='intro';
 const defaultBirthday='2000-06-15',defaultStart=careerStartDate({birthday:defaultBirthday});
 screen.innerHTML=`<section class="intro-head"><h1>Live a whole life <span class="marquee-word">in the movies.</span></h1><p>Born into real film history from 1960 on. Audition for real roles, rewrite who got cast, fall in love, buy the house on the hill, and see how it all ends.</p></section>
 <form id="new" class="card"><label for="name">Name</label><input id="name" name="name" required maxlength="60" placeholder="Your actor's name" autocomplete="off">
 <div class="grid"><div><label for="gender">Gender</label><select name="gender" id="gender" required><option value="male">Male</option><option value="female">Female</option><option value="nonbinary">Non-binary</option></select></div><div><label for="background">Family</label><select name="background" id="background"><option value="ordinary">Ordinary</option><option value="industry">Showbiz family</option></select></div></div>
 <label for="birthday">Date of birth</label><input id="birthday" name="birthday" type="date" min="1900-01-01" max="2100-12-31" value="${defaultBirthday}" required>
 <label for="startDate">Story starts</label><input id="startDate" name="startDate" type="date" min="1960-01-01" max="2199-12-31" value="${defaultStart}" required>
 <div class="chips"><button type="button" class="chip" id="startChild">Start at 4</button><button type="button" class="chip" id="startAdult">Start at 18</button></div>
 <p class="muted" id="birthHint"></p><p class="muted" id="opportunityPreview"></p>
 <button type="submit" class="primary block">Begin life</button></form>
 <p class="muted" style="padding:0 4px">${esc(databaseStatus())}</p>`;
 let customStart=false;
 const update=()=>{const birthday=$('#birthday').value,startDate=$('#startDate').value;try{const date=careerStartDate({birthday,startDate});$('#startDate').setCustomValidity('');$('#birthHint').textContent=`Your story begins ${fmtDate(date)}, at age ${ageAt(birthday,Number(date.slice(0,4)),Number(date.slice(5,7)),Number(date.slice(8)))}.`}catch(e){$('#startDate').setCustomValidity(e.message);$('#birthHint').textContent=e.message}$('#opportunityPreview').innerHTML=opportunityMarkup(birthday,$('#gender').value,startDate)};
 const setAge=age=>{const birthday=$('#birthday').value;if(!birthday)return;const date=new Date(`${birthday}T12:00:00Z`);if(Number.isNaN(date.getTime()))return;date.setUTCFullYear(date.getUTCFullYear()+age);$('#startDate').value=date.toISOString().slice(0,10);update()};
 $('#birthday').oninput=()=>{if(!customStart)setAge(4);else update()};$('#startDate').oninput=()=>{customStart=true;update()};$('#gender').onchange=update;
 $('#startChild').onclick=()=>{customStart=false;setAge(4)};$('#startAdult').onclick=()=>{customStart=true;setAge(18)};update();
 $('#new').onsubmit=async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target)),button=e.target.querySelector('button[type=submit]');try{const date=careerStartDate(values),year=Number(date.slice(0,4));button.disabled=true;button.textContent='Loading film history…';catalogue=catalogue.filter(p=>p.generated);loadedYears.clear();for(const y of [year-1,year,year+1,year+2])await loadYear(y);state=createCareer(values,catalogue);migrateOverhaul(state,catalogue);ensureLife(state);tab='life';save();render();window.scrollTo(0,0)}catch(err){toast(err.message);button.disabled=false;button.textContent='Begin life'}};
}
function opportunityMarkup(birthday,gender,startDate){
 let date;try{date=careerStartDate({birthday,startDate})}catch(e){return ''}
 const birthYear=Number(birthday.slice(0,4)),start=Number(date.slice(0,4));let total=0;
 for(let year=start;year<start+6;year++)total+=opportunityIndex?.[String(year)]?.[normaliseGender(gender)]?.[String(year-birthYear)]??0;
 return total?`About ${total.toLocaleString()} real roles you could play start casting in your first six years.`:''
}
function cheats(){
 if(!state)return toast('Start a life first.');
 const contacts=state.people.filter(p=>p.id!==state.activeId&&p.alive),castmates=contacts.filter(p=>p.occupation==='Actor'&&state.relationships[p.name]).map(p=>p.name);
 const m=modal(`<h2>Cheats</h2><p class="muted">Changes save immediately.</p><div class="section-title">You</div><div><button class="secondary" data-cheat="acting">Max acting</button><button class="secondary" data-cheat="drama">Max drama</button><button class="secondary" data-cheat="comedy">Max comedy</button><button class="secondary" data-life-cheat="happiness">Max happiness</button><button class="secondary" data-life-cheat="health">Max health</button><button class="secondary" data-life-cheat="looks">Max looks</button><button class="secondary" data-life-cheat="cure">Cure everything</button><button class="secondary" data-life-cheat="money">+$100,000</button><button class="secondary" data-life-cheat="million">+$1,000,000</button><button class="secondary" data-life-cheat="fame">+20 fame</button><button class="secondary" data-life-cheat="energy">Refill energy</button></div><div class="section-title">Relationships</div><select id="cheatPerson" aria-label="Relationship target"><option value="__castmates__">All known castmates (${castmates.length})</option>${contacts.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.relative?` · ${esc(p.relative)}`:''}</option>`).join('')}</select><div><button class="secondary" data-cheat="friendship">Max friendship</button><button class="secondary" data-cheat="respect">Max respect</button><button class="secondary" data-cheat="chemistry">Max chemistry</button></div><label><input type="checkbox" id="allowRecasting" ${state.allowRecasting?'checked':''}>Allow recasting established characters</label><p class="muted">Romantic chemistry only applies between adults or close-age teenagers, never relatives, and never starts a relationship by itself.</p><p class="notice" id="cheatResult" aria-live="polite">Pick a cheat.</p>`);
 m.querySelector('#allowRecasting').onchange=e=>{state.allowRecasting=e.target.checked;save();render()};
 m.querySelectorAll('[data-life-cheat]').forEach(b=>b.onclick=()=>{const k=b.dataset.lifeCheat,st=ensureLife(state);if(k==='happiness')st.happiness=100;if(k==='looks')st.looks=100;if(k==='health')state.health=100;if(k==='cure')for(const c of conditionsOf(state))c.status='recovered';if(k==='money')state.money+=100000;if(k==='million')state.money+=1000000;if(k==='fame')state.fame=Math.min(100,state.fame+20);if(k==='energy')state.energy=100;save();render();m.querySelector('#cheatResult').textContent='Done.'});
 m.querySelectorAll('[data-cheat]').forEach(b=>b.onclick=()=>{const target=m.querySelector('#cheatPerson').value,names=target==='__castmates__'?castmates:contacts.filter(p=>p.id===target).map(p=>p.name);try{const changed=applyCheat(state,b.dataset.cheat,names);save();render();m.querySelector('#cheatResult').textContent=['acting','drama','comedy'].includes(b.dataset.cheat)?`${b.dataset.cheat} is now 100.`:changed?`Updated ${changed} ${changed===1?'relationship':'relationships'}${b.dataset.cheat==='chemistry'?' · romantic chemistry is now 100':''}.`:b.dataset.cheat==='chemistry'?'No eligible matches selected. Chemistry needs two adults, or close-age teenagers, and never relatives.':'Nobody eligible was selected.'}catch(e){toast(e.message)}});
}
function openMenu(){
 const m=modal(`<h2>Second Take</h2><p class="muted">Version 1.7 · your save lives on this device. Export it now and then as a backup.</p><div class="sheet-actions"><button class="secondary" id="openLegacy">Family legacy</button><button class="secondary" id="openCheats">Cheats</button><button class="secondary" id="exportSave">Export save</button><label for="importSave" style="margin:4px 0 0">Import a save (.json)</label><input id="importSave" type="file" accept="application/json,.json"><button class="danger" id="resetSave">Start a new life</button></div><p class="muted" style="margin-top:14px">${esc(databaseStatus())} Changed castings, relationships and events are fictional. An independent fan project, not affiliated with any studio. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>`);
 m.querySelector('#openLegacy').onclick=()=>{m.remove();navigate('legacy')};
 m.querySelector('#openCheats').onclick=()=>{m.remove();cheats()};
 m.querySelector('#exportSave').onclick=()=>{if(!state)return toast('Start a life first.');const url=URL.createObjectURL(new Blob([JSON.stringify(state)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`second-take-${state.year}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)};
 m.querySelector('#importSave').onchange=async e=>{try{const v=JSON.parse(await e.target.files[0].text());if(v.version!==1||!Array.isArray(v.people)||!Array.isArray(v.timeline)||!v.activeId||!Number.isInteger(v.year))throw Error('This is not a Second Take save.');await loadCareerYears(v);state=v;migrateOverhaul(state,catalogue);state.date??=currentDate(state);state.directors??={};state.possessions??=[];state.people.forEach(p=>p.gender??='unspecified');ensureLife(state);save();m.remove();tab='life';render()}catch(err){toast(err.message)}};
 m.querySelector('#resetSave').onclick=()=>{m.remove();newLife()};
}
function newLife(){if(!confirm('Start a new life? This replaces the save on this device. Export it first if you want to keep it.'))return;localStorage.removeItem(SAVE_KEY);state=null;document.querySelectorAll('.modal').forEach(m=>m.remove());render()}
function navigate(next,{seg,fromNav=false}={}){if(next==='career'&&!fromNav)setCareerSeg(seg||'offers');tab=next;render();window.scrollTo(0,0)}
function uiContext(){return {state,catalogue,franchiseData,esc,money,fmtDate,save,render,toast,action,modal,advanceWeeks,loadYear,loadCareerYears,showResult,openMenu,newLife,navigate,switchTo:id=>switchTo(state,id)}}

let advancing=false;
async function advanceWeeks(count,{resume=false}={}){
 if(advancing||!state||state.complete)return;
 if(openLifeEvent(state)){presentEventSheet();return}
 advancing=true;setBusy(true);let remaining=resume?state.advanceRemaining:Math.round(count*7);state.advanceRemaining=0;
 try{
  while(remaining>0&&!state.complete){
   const date=currentDate(state),end=plusDays(date,Math.min(7,remaining));
   if(Number(end.slice(0,4))!==state.year)await loadCareerYears({...state,year:Number(end.slice(0,4))});
   let next=nextScheduledDate(state,end);
   const dates=[...state.commitments.filter(c=>c.personId===state.activeId&&c.status==='scheduled').map(c=>c.end),...state.applications.filter(a=>a.personId===state.activeId&&['watching','considering','invited','callback'].includes(a.status)).flatMap(a=>[a.readyOn,a.expiresOn]),...state.careerAuditions.filter(a=>a.personId===state.activeId&&a.status==='callback').map(a=>a.readyOn),...state.filmography.filter(f=>f.personId===state.activeId&&!['released','withdrawn'].includes(f.status)).flatMap(f=>{const p=[...catalogue,...state.projects].find(p=>p.id===f.projectId);return p?[projectSchedule(p).filmingStart,projectSchedule(p).filmingEnd,projectSchedule(p).releaseDate]:[]}),...state.awards.filter(a=>a.personId===state.activeId&&a.status==='nominated').map(a=>a.ceremonyDate)];
   for(const d of dates)if(d>date&&d<next)next=d;
   const days=Math.max(1,daysBetween(date,next));
   advance(state,catalogue,{days});careerTick(state,catalogue,franchiseData);
   continuityTick(state,catalogue,{shows:seasonShows,franchises:franchiseData,overrides:continuityOverrides});
   overhaulTick(state,catalogue);
   if(!state.complete){spinoffTick(state,catalogue);weeklyLife(state,catalogue,days)}
   remaining-=days;
   if(state.continuityRequests.some(r=>![...catalogue,...state.projects].some(p=>p.id===r.projectId)&&r.year<=state.year+2))await loadCareerYears(state);
   if(openLifeEvent(state)){state.advanceRemaining=Math.max(0,remaining);break}
  }
  save();render();
 }catch(err){state.advanceRemaining=Math.max(0,remaining);save();render();toast(err.message)}finally{advancing=false;setBusy(false)}
}
function setBusy(on){const b=$('#ageButton');if(b){b.classList.toggle('busy',on);b.disabled=on}}
function updateNav(){
 const n=attentionCount(state),badge=nav.querySelector('[data-badge="career"]');badge.hidden=!n;badge.textContent=n;
 const invites=state.socialInvitations.filter(e=>e.personId===state.activeId).length,pb=nav.querySelector('[data-badge="people"]');pb.hidden=!invites;pb.textContent=invites;
 nav.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab&&b.id!=='ageButton'));
 const age=ageAt(state.birthday,state.year,state.month,Number(currentDate(state).slice(8)));
 $('#ageLabel').textContent=state.complete?'The end':'+1 month';$('#ageSub').textContent=state.complete?'':`Age ${age}`;
}
function render(){
 if(!state){intro();return}
 ensureRelationships(state);ensureOverhaul(state);ensureLife(state);syncCalendar(state,[...catalogue,...state.projects],projectSchedule);
 nav.hidden=false;screen.className=tab==='life'?'':'no-dock';const u=uiContext();
 renderTopbar(topbar,u);updateNav();
 if(tab==='life')renderDock(dock,u);else dock.hidden=true;
 ({life:()=>renderLife(screen,u),career:()=>renderCareer(screen,u),assets:()=>renderAssets(screen,u),people:()=>renderRelationships(screen,{state,catalogue,esc,fmtDate,save,render,toast,advanceWeeks,showResult}),activities:()=>renderActivities(screen,u),legacy:()=>renderLegacy(screen,u)}[tab]||(()=>renderLife(screen,u)))();
 presentEventSheet();
}
nav.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b||!state)return;if(b.id==='ageButton'){if(state.complete){navigate('life');return}const was=tab;tab='life';if(was!=='life'){render();window.scrollTo(0,0)}advanceWeeks(4);return}navigate(b.dataset.tab,{fromNav:true})});
async function init(){try{
 const response=await fetch('./data/sample.json?v=16');if(!response.ok)throw Error('Catalogue failed to load.');const sample=(await response.json()).projects;
 const manifest=await fetch('./data/years/index.json?v=16');if(!manifest.ok)throw Error('Historical database index could not load. Please try again online.');dbMeta=await manifest.json();yearIndex=new Set(dbMeta.years||[]);opportunityIndex=dbMeta.opportunities||{};
 franchiseData=await readCatalogueResponse(await fetch('./data/franchises.json.gz?v=16'),true);
 seasonIndex=await readCatalogueResponse(await fetch('./data/tv-seasons/index.json.gz?v=16'),true);
 const filmographies=await fetch('./data/filmographies/index.json?v=16');if(!filmographies.ok)throw Error('Permanent filmographies could not load. Please try again online.');filmographyIndex=await filmographies.json();
 seasonIndex={...seasonIndex,shows:{...seasonIndex.shows,...filmographyIndex.shows}};
 const overrides=await fetch('./data/continuity-overrides.json?v=16');if(!overrides.ok)throw Error('Character continuity could not load.');continuityOverrides=await overrides.json();
 catalogue=attachFranchises(sample.filter(p=>!yearIndex.has(p.year)),franchiseData);
 const raw=localStorage.getItem(SAVE_KEY);
 if(raw){const loaded=JSON.parse(raw);if(loaded.version===1&&Array.isArray(loaded.people)){state=loaded;state.date??=currentDate(state);state.directors??={};state.possessions??=[];state.people.forEach(p=>p.gender??='unspecified');await loadCareerYears(state);migrateOverhaul(state,catalogue);ensureLife(state);save()}}
 render();if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js?v=16').catch(()=>{})
}catch(e){screen.innerHTML=`<div class="card"><h2>Could not load the game</h2><p>${esc(e.message)}</p><p class="muted">Open it from GitHub Pages or a local web server rather than as a file.</p></div>`}}
init();
