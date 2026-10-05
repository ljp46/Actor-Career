export const SAVE_KEY='second-take-save-v1';
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const ageAt=(birth,year,month,day=31)=>year-Number(birth.slice(0,4))-(month<Number(birth.slice(5,7))||month===Number(birth.slice(5,7))&&day<Number(birth.slice(8,10))?1:0);
export const currentDate=s=>s.date||new Date(Date.UTC(s.year,s.month,0)).toISOString().slice(0,10);
const addDays=(date,days)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
const weekDiff=(a,b)=>Math.ceil((Date.parse(`${b}T12:00:00Z`)-Date.parse(`${a}T12:00:00Z`))/604800000);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&!Number.isNaN(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
export function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296}
export function pick(s,items){return items[Math.floor(rand(s)*items.length)]}
const first=['Avery','Morgan','Jordan','Noah','Elena','Maya','Luca','Theo','Isla','Sofia','Amara','Finn','Cleo','Ezra','Rowan','Riley','Jules','Nina','Leo','Nico','Sam','Aria','Max','Dara'];
const last=['Mercer','Vale','Navarro','Hayes','Okafor','Chen','Reyes','Patel','Arden','Hale','Bennett','Marin','Price','Sato','Brooks','Vega','Bell','Quinn','Rossi','Mills','Stone','Ward','Cruz'];
const adjectives=['Golden','Last','Silent','Broken','Hidden','Midnight','Electric','Distant','Northern','Wild','Blue','Lost','Open','Red','Other'];
const nouns=['Summer','City','Road','Light','Hour','River','Sky','Promise','Kingdom','Heart','Room','Echo','Signal','Shore','Star'];
export function uniqueName(s,kind){const set=kind==='person'?s.usedPeople:s.usedTitles;const base=kind==='person'?`${pick(s,first)} ${pick(s,last)}`:`${pick(s,adjectives)} ${pick(s,nouns)}`;let candidate=base;while(set.includes(candidate))candidate=`${base} ${s.nextId++}`;set.push(candidate);return candidate}
function nextId(s,prefix){return `${prefix}-${s.nextId++}`}
export function normaliseGender(g){
 const value=String(g??'').toLowerCase().replace(/[^a-z]/g,'');
 if(['male','man','m','boy'].includes(value))return 'male';
 if(['female','woman','f','girl'].includes(value))return 'female';
 if(['nonbinary','nonbinaryperson','nb'].includes(value))return 'nonbinary';
 if(value==='any')return 'any';
 return 'unspecified'
}
export function genderCompatible(personGender,roleGender){
 const person=normaliseGender(personGender),role=normaliseGender(roleGender);
 if(role==='any'||role==='unspecified')return true;
 if(person==='unspecified'||person==='any')return false;
 return person===role
}
export function genderLabel(g){const value=normaliseGender(g);return value==='male'?'Male':value==='female'?'Female':value==='nonbinary'?'Non-binary':'Unspecified'}
export function person(s,name,occupation='Other',birthYear=s.year-25,relative='',gender='unspecified'){const p={id:nextId(s,'person'),name,occupation,birthYear,relative,gender:normaliseGender(gender),relationship:relative?65:0,chemistry:0,respect:0,rivalry:0,interference:0,alive:true};s.people.push(p);if(!s.usedPeople.includes(name))s.usedPeople.push(name);return p}
export function careerStartDate({birthday,startDate}){
 const birthYear=Number(birthday?.slice(0,4));
 if(!validDate(birthday)||birthYear<1900||birthYear>2100)throw new Error('Choose a valid birthday from 1900 to 2100.');
 let fourth=`${birthYear+4}-${birthday.slice(5)}`;
 if(!validDate(fourth))fourth=`${birthYear+4}-03-01`;
 const date=startDate||fourth;
 if(!validDate(date)||date<'1960-01-01'||date>'2199-12-31')throw new Error('Choose a valid starting date from 1960 to 2199.');
 if(ageAt(birthday,Number(date.slice(0,4)),Number(date.slice(5,7)),Number(date.slice(8)))<4)throw new Error('Your actor must be at least four on the starting date.');
 return date
}
export function createCareer({name,birthday,startDate,background,gender='unspecified'},catalogue){const date=careerStartDate({birthday,startDate}),birthYear=Number(birthday.slice(0,4)),year=Number(date.slice(0,4)),month=Number(date.slice(5,7));if(!name?.trim())throw new Error('Choose your actor’s name.');const s={version:1,rng:(birthYear*14137+name.length*113+month)>>>0,nextId:1,year,month,date,birthday,activeId:'self',people:[],children:[],possessions:[],usedPeople:[],usedTitles:[],projects:[],casts:{},directors:{},filmography:[],relationships:{},timeline:[],notifications:[],choices:[],skills:{acting:8,comedy:5,drama:5},fame:0,respect:0,money:0,health:92,representation:0,background,deathNotices:[],complete:false};person(s,name.trim(),'Aspiring actor',birthYear,'Self',gender).id='self';const names=new Set(s.usedPeople),titles=new Set();for(const project of catalogue){titles.add(project.title);if(project.director)names.add(project.director);for(const role of project.roles)if(role.actor)names.add(role.actor)}s.usedPeople=[...names];s.usedTitles=[...titles];const familyJob=background==='industry'?pick(s,['Actor','Director','Producer']):pick(s,['Teacher','Nurse','Tradesperson','Office worker']);person(s,uniqueName(s,'person'),familyJob,birthYear-26,'Parent',pick(s,['female','male']));person(s,uniqueName(s,'person'),pick(s,['Actor','Writer','Teacher','Other']),birthYear-22,'Parent',pick(s,['female','male']));person(s,uniqueName(s,'person'),pick(s,['Actor','Director','Student','Other']),birthYear+pick(s,[-4,-2,2,4]),'Sibling',pick(s,['female','male','nonbinary']));if(year>=2026)for(let y=Math.max(2027,year);y<=Math.max(2027,year+2);y++)generatedYear(s,y);s.timeline.push({year,month,date,title:'A life begins',body:`${name.trim()} begins this story at age ${ageAt(birthday,year,month,Number(date.slice(8)))}. A future in acting is one possibility, not a requirement.`});return s}
export const active=s=>s.people.find(p=>p.id===s.activeId);
export function ensurePerson(s,name,occupation='Actor',birthYear=null,gender='unspecified'){let p=s.people.find(p=>p.name===name);if(p){if(normaliseGender(p.gender)==='unspecified'&&normaliseGender(gender)!=='unspecified')p.gender=normaliseGender(gender);return p}return person(s,name,occupation,birthYear||s.year-30,'',gender)}
export const castingYear=p=>Math.max(1960,p.castingYear??p.year-1);
// TMDB supplies release dates, not a dependable shoot calendar. These windows are game estimates.
const scheduleCache=new WeakMap();
export function projectSchedule(p){
 const signature=[p.id,p.year,p.kind,p.voteCount,p.popularity,p.releaseDate,p.filmingEndDate,p.filmingStartDate,p.castingStartDate].join('|');
 const cached=scheduleCache.get(p);if(cached?.signature===signature)return cached.schedule;
 const big=Number(p.voteCount||0)>=1000||Number(p.popularity||0)>=80;
 const tv=p.kind==='TV series';
 let releaseDate=validDate(p.releaseDate)?p.releaseDate:`${p.year}-${String(6+hashText(p.id)%6).padStart(2,'0')}-15`;
 const durationWeeks=tv?(big?22:14):(big?22:10);
 const gapWeeks=tv?10:(big?30:20);
 let filmingEnd=validDate(p.filmingEndDate)?p.filmingEndDate:addDays(releaseDate,-7*gapWeeks);
 let filmingStart=validDate(p.filmingStartDate)?p.filmingStartDate:addDays(filmingEnd,-7*durationWeeks);
 let castingStart=validDate(p.castingStartDate)?p.castingStartDate:addDays(filmingStart,-7*(big?26:20));
 if(castingStart<'1960-01-01'){const shift=Math.round((Date.parse('1960-01-01T12:00:00Z')-Date.parse(`${castingStart}T12:00:00Z`))/86400000);castingStart=addDays(castingStart,shift);filmingStart=addDays(filmingStart,shift);filmingEnd=addDays(filmingEnd,shift);releaseDate=addDays(releaseDate,shift)}
 const schedule={castingStart,castingEnd:filmingStart,filmingStart,filmingEnd,releaseDate,durationWeeks:weekDiff(filmingStart,filmingEnd),estimated:!validDate(p.filmingStartDate)||!validDate(p.filmingEndDate)};scheduleCache.set(p,{signature,schedule});return schedule
}
export function filmingProjects(s,catalogue){const booked=new Set(s.filmography.filter(f=>f.personId===s.activeId).map(f=>f.projectId)),date=currentDate(s);return [...catalogue,...s.projects].filter(p=>{if(!booked.has(p.id))return false;const t=projectSchedule(p);return date>=t.filmingStart&&date<t.filmingEnd})}
export function playingAge(birthYear,project){return project.year-birthYear}
export function roleFitForAge(age,role){
 const target=role.characterAge??Math.round((role.ageMin+role.ageMax)/2),gap=Math.abs(age-target);
 let fit=100-gap*7;
 if(age<role.ageMin)fit-=(role.ageMin-age)*5;
 if(age>role.ageMax)fit-=(age-role.ageMax)*5;
 return clamp(Math.round(fit),0,100)
}
export function roleFit(s,project,role){const actor=active(s);if(!genderCompatible(actor.gender,role.gender))return 0;return roleFitForAge(playingAge(actor.birthYear,project),role)}
export function projectPhase(s,p){const d=currentDate(s),t=projectSchedule(p);return d<t.castingStart?'Announced':d<t.filmingStart?'Casting':d<t.filmingEnd?'Filming':d<t.releaseDate?'Post-production':'Released'}
export function worldProjects(s,catalogue){const d=currentDate(s),from=addDays(d,-365),to=addDays(d,365);return [...catalogue,...s.projects].filter(p=>{const t=projectSchedule(p);return t.castingStart<=to&&t.releaseDate>=from}).sort((a,b)=>projectSchedule(a).castingStart.localeCompare(projectSchedule(b).castingStart)||a.title.localeCompare(b.title))}
export function childOpportunityPreview(birthday,catalogue,years=6,gender=null){const birthYear=Number(birthday.slice(0,4)),start=birthYear+4,byYear={};for(let year=start;year<start+years;year++){byYear[year]=catalogue.flatMap(p=>p.roles.map(r=>({p,r}))).filter(({p,r})=>Number(projectSchedule(p).castingStart.slice(0,4))===year&&(!gender||genderCompatible(gender,r.gender))&&roleFitForAge(playingAge(birthYear,p),r)>=35).length}return{start,end:start+years-1,total:Object.values(byYear).reduce((a,b)=>a+b,0),byYear}}
function hashText(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
function estimatedBirth(project,role){return role.birthYear??project.year-(role.characterAge??Math.round((role.ageMin+role.ageMax)/2))}
const performerPools=new WeakMap();
function performerPool(projects){
 const cached=performerPools.get(projects);if(cached?.length===projects.length)return cached.people;
 const people=new Map();
 for(const project of projects)for(const role of project.roles)if(!people.has(role.actor))people.set(role.actor,{name:role.actor,birthYear:estimatedBirth(project,role),gender:normaliseGender(role.gender)});
 const pool=[...people.values()];performerPools.set(projects,{length:projects.length,people:pool});return pool
}
export function auditionShortlist(s,catalogue,project,role,index){const player=active(s),playerFit=roleFit(s,project,role),seen=new Set([player.name]),candidates=[{name:player.name,fit:playerFit,player:true,birthYear:player.birthYear,gender:normaliseGender(player.gender)}];const originalBirth=estimatedBirth(project,role),originalFit=Math.max(68,roleFitForAge(playingAge(originalBirth,project),role)),roleGender=normaliseGender(role.gender);candidates.push({name:role.actor,fit:originalFit,original:true,birthYear:originalBirth,gender:roleGender});seen.add(role.actor);const pool=[...performerPool(catalogue),...performerPool(s.projects)].filter(x=>!seen.has(x.name)&&genderCompatible(x.gender,roleGender));pool.sort((a,b)=>hashText(`${project.id}:${index}:${a.name}`)-hashText(`${project.id}:${index}:${b.name}`));for(const c of pool){if(seen.has(c.name))continue;const fit=roleFitForAge(playingAge(c.birthYear,project),role);if(fit<45)continue;candidates.push({...c,fit});seen.add(c.name);if(candidates.length===5)break}let fallbackAttempt=0;while(candidates.length<5){fallbackAttempt++;const n=`${first[hashText(project.id+fallbackAttempt)%first.length]} ${last[hashText(role.character+fallbackAttempt)%last.length]}`;if(seen.has(n))continue;const target=role.characterAge??Math.round((role.ageMin+role.ageMax)/2),birthYear=project.year-target+(candidates.length%3-1);candidates.push({name:n,birthYear,fit:roleFitForAge(playingAge(birthYear,project),role),gender:roleGender,fictional:true});seen.add(n)}return candidates.sort((a,b)=>b.fit-a.fit)}
export function generatedYear(s,year){if(year<2027||s.projects.some(p=>p.year===year))return;const directors=s.people.filter(p=>p.occupation==='Director'&&p.alive);for(let i=0;i<12;i++){let directorPerson=directors.length&&rand(s)<.3?pick(s,directors):null;const director=directorPerson?.name||uniqueName(s,'person');if(!directorPerson)directorPerson=ensurePerson(s,director,'Director',year-pick(s,[28,34,41,52]),pick(s,['female','male','nonbinary']));const title=uniqueName(s,'title'),roles=[],roleCount=3+Math.floor(rand(s)*4);for(let j=0;j<roleCount;j++){const roleGender=rand(s)<.49?'female':rand(s)<.96?'male':'nonbinary',targetAge=j===0?pick(s,[17,21,28,35,45]):pick(s,[8,12,16,22,30,40,55]);const known=s.people.filter(p=>p.occupation==='Actor'&&p.alive&&genderCompatible(p.gender,roleGender)&&Math.abs((year-p.birthYear)-targetAge)<18);const name=known.length&&rand(s)<.45?pick(s,known).name:uniqueName(s,'person');ensurePerson(s,name,'Actor',year-targetAge+pick(s,[-2,-1,0,1,2]),roleGender);roles.push({character:pick(s,['Alex','Charlie','Robin','Taylor','Eden','Jordan','Casey','Morgan'])+` ${j+1}`,actor:name,gender:roleGender,characterAge:targetAge,ageMin:Math.max(4,targetAge-6),ageMax:Math.min(90,targetAge+10)})}s.projects.push({id:nextId(s,'future'),title,year,kind:i%4===3?'TV series':'Film',director,genre:pick(s,['Drama','Comedy','Action','Thriller','Romance','Science fiction','Fantasy']),roles,generated:true})}}
export function available(s,catalogue){
 if(s.complete)return[];
 const actor=active(s),date=currentDate(s);if(ageAt(s.birthday,s.year,s.month,Number(date.slice(8)))<4)return[];
 const decided=new Set(s.choices),won=new Set(s.filmography.filter(f=>f.personId===actor.id).map(f=>f.projectId));
 const projects=[...catalogue,...s.projects],booked=projects.filter(p=>won.has(p.id)).map(projectSchedule),offers=[];
 for(const project of projects){
  if(project.legacyOnly||won.has(project.id))continue;
  const t=projectSchedule(project);if(date<t.castingStart||date>=t.castingEnd||booked.some(b=>t.filmingStart<b.filmingEnd&&b.filmingStart<t.filmingEnd))continue;
  project.roles.forEach((role,index)=>{const key=`${project.id}:${index}`;if(s.casts[key]||decided.has(key))return;const fit=roleFit(s,project,role);if(fit>=35)offers.push({project,role,index,fit})})
 }
 return offers.sort((a,b)=>b.fit-a.fit||a.project.title.localeCompare(b.project.title)||a.index-b.index)
}
export function audition(s,catalogue,project,role,index){const key=`${project.id}:${index}`;if(!available(s,catalogue).some(o=>o.project.id===project.id&&o.index===index))throw new Error('This audition is closed or conflicts with another shoot.');if(s.choices.includes(key)||s.casts[key])throw new Error('This part has already been decided.');const a=active(s),fit=roleFit(s,project,role);if(fit<35)throw new Error('Your playing age is not close enough for this role.');s.choices.push(key);const directorName=directorFor(s,project),shortlist=auditionShortlist(s,catalogue,project,role,index);for(const c of shortlist)ensurePerson(s,c.name,'Actor',c.birthYear,c.gender);const playerEntry=shortlist.find(c=>c.player),playerWeight=Math.max(1,(playerEntry.fit*.7+s.skills.acting*.8+s.fame*.35+s.representation*5+(s.background==='industry'?8:0)));const weighted=shortlist.map(c=>({...c,weight:c.player?playerWeight:Math.max(1,c.fit*(c.original?1.05:.88)+(hashText(c.name+project.id)%18))}));let roll=rand(s)*weighted.reduce((sum,c)=>sum+c.weight,0),winner=weighted[weighted.length-1];for(const c of weighted){roll-=c.weight;if(roll<=0){winner=c;break}}const win=winner.player===true,original=ensurePerson(s,role.actor,'Actor',role.birthYear,role.gender),director=ensurePerson(s,directorName,'Director');s.casts[key]=winner.name;if(win){s.filmography.push({projectId:project.id,title:project.title,year:project.year,kind:project.kind,role:role.character,personId:a.id,original:role.actor,director:directorName});s.filmography.at(-1).status='booked';s.filmography.at(-1).bookedOn=currentDate(s);s.filmography.at(-1).fee=project.year<1980?1200:project.year<2000?8500:28000;s.respect=clamp(s.respect+1,0,100);s.relationships[director.name]??={friendship:0,respect:0,chemistry:0};s.relationships[director.name].respect+=8;for(const [i,r] of project.roles.entries()){if(i===index)continue;const costarName=castFor(s,project,i);ensurePerson(s,costarName,'Actor',estimatedBirth(project,r),r.gender);const bond=s.relationships[costarName]??={friendship:0,respect:0,chemistry:0};bond.chemistry=clamp(bond.chemistry+5,0,100);bond.respect=clamp(bond.respect+3,0,100)}original.interference++;original.rivalry=clamp(original.rivalry+(original.interference>1?18:5),0,100);if(original.interference>=2)s.timeline.unshift({year:s.year,month:s.month,title:'A rivalry takes shape',body:`You have now won ${original.interference} parts originally associated with ${original.name}. The press begins connecting your careers.`})}s.timeline.unshift({year:s.year,month:s.month,title:`Audition: ${project.title}`,body:win?`You won the role of ${role.character}, displacing ${original.name}.`:`${winner.name} won the role of ${role.character}${winner.original?' as in real history':', changing this timeline'}.`});return{win,winner:winner.name,original:original.name,fit,shortlist:weighted.map(({name,fit,player,original})=>({name,fit,player,original}))}}
function useActivity(s){const date=currentDate(s);s.weeklyActivities??={week:date,used:0};if(s.weeklyActivities.week!==date)s.weeklyActivities={week:date,used:0};if(s.weeklyActivities.used>=2)throw new Error('Your weekly activity time is full. Advance a week.');s.weeklyActivities.used++}
export function train(s,kind){if(!['acting','drama','comedy'].includes(kind))throw new Error('Unknown practice.');useActivity(s);const cost=kind==='acting'&&s.money>500?150:0;if(cost)s.money-=cost;s.skills[kind]=clamp(s.skills[kind]+(cost?3:1),0,100);s.health=clamp(s.health-1,0,100);s.timeline.unshift({year:s.year,month:s.month,date:currentDate(s),title:'Practice',body:`${kind} improves to ${s.skills[kind]}.`})}
export function lifestyle(s,kind){
 if(!['rest','fitness','nightout'].includes(kind))throw new Error('Unknown activity.');
 if(kind==='nightout'&&ageAt(s.birthday,s.year,s.month,Number(currentDate(s).slice(8)))<18)throw new Error('This activity is for adults.');
 if(kind==='nightout'&&s.money<100)throw new Error('You need $100 for a night out.');
 useActivity(s);
 if(kind==='rest')s.health=clamp(s.health+8,0,100);
 if(kind==='fitness')s.health=clamp(s.health+3,0,100);
 if(kind==='nightout'){s.money-=100;s.health=clamp(s.health-2,0,100);s.fame=clamp(s.fame+(rand(s)<.3?1:0),0,100)}
 const title={rest:'A quiet day',fitness:'Keeping active',nightout:'A night out'}[kind];
 s.timeline.unshift({year:s.year,month:s.month,date:currentDate(s),title,body:{rest:'You make time to recover.',fitness:'You keep your body ready for long days on set.',nightout:'You head out and enjoy life beyond work.'}[kind]})
}
export function familyCasting(s,catalogue,year){
 const family=s.people.filter(p=>p.relative&&p.relative!=='Self'&&p.alive),projects=[...catalogue,...s.projects].filter(p=>p.year===year);
 for(const f of family){
  if(f.occupation==='Director'&&year-f.birthYear>=22){
   const existing=projects.filter(p=>s.directors[p.id]===f.name);
   if(existing.length||rand(s)>=.3)continue;
   const options=projects.filter(p=>!s.directors[p.id]);if(!options.length)continue;
   const p=pick(s,options);s.directors[p.id]=f.name;
   s.timeline.unshift({year:s.year,month:s.month,title:'Family behind the camera',body:`${f.name} is directing ${p.title} in this timeline.`});
  }
  if(f.occupation!=='Actor')continue;
  const credits=s.filmography.filter(c=>c.personId===f.id&&c.year===year),booked=new Set(credits.map(c=>c.projectId));
  const schedules=projects.filter(p=>booked.has(p.id)).map(projectSchedule);
  for(let slot=credits.length;slot<2;slot++){
   if(rand(s)>=.65)break;
   const options=[];
   for(const p of projects){const t=projectSchedule(p);if(booked.has(p.id)||schedules.some(b=>t.filmingStart<b.filmingEnd&&b.filmingStart<t.filmingEnd))continue;
    p.roles.forEach((r,i)=>{if(!s.casts[`${p.id}:${i}`]&&genderCompatible(f.gender,r.gender)&&roleFitForAge(year-f.birthYear,r)>=35)options.push({p,r,i})});
   }
   if(!options.length)break;
   const {p,r,i}=pick(s,options);s.casts[`${p.id}:${i}`]=f.name;booked.add(p.id);schedules.push(projectSchedule(p));
   s.filmography.push({projectId:p.id,title:p.title,year:p.year,kind:p.kind,role:r.character,personId:f.id,original:r.actor,director:s.directors[p.id]||p.director});
   s.timeline.unshift({year:s.year,month:s.month,title:'A family casting',body:`${f.name} has been cast as ${r.character} in ${p.title}, taking ${r.actor}'s original part.`});
  }
 }
}
export function applyCheat(s,kind,names=[]){
 if(['acting','drama','comedy'].includes(kind)){s.skills[kind]=100;return 1}
 if(!['friendship','respect','chemistry'].includes(kind))throw new Error('Unknown cheat.');
 let changed=0;const targets=new Set(names),date=currentDate(s);
 for(const p of s.people){
  if(!targets.has(p.name)||p.id===s.activeId||!p.alive)continue;
  if(kind==='chemistry'&&(p.relative||ageAt(s.birthday,s.year,s.month,Number(date.slice(8)))<18||ageAt(p.birthDate||`${p.birthYear}-01-01`,s.year,s.month,Number(date.slice(8)))<18))continue;
  const r=s.relationships[p.name]??={friendship:0,respect:0,chemistry:0,dating:false};
  r[kind]=100;p[kind==='friendship'?'relationship':kind]=100;changed++;
 }
 return changed
}
export function advance(s,catalogue){
 if(s.complete)return;
 const previous=currentDate(s),year=s.year;
 s.date=addDays(previous,7);s.year=Number(s.date.slice(0,4));s.month=Number(s.date.slice(5,7));s.socialActions={week:s.date,used:0,people:[]};s.weeklyActivities={week:s.date,used:0};
 const a=active(s);
 s.health=clamp(s.health+(rand(s)<.55?1:-1),5,100);
 if(s.year>year){
  s.money=Math.round(s.money*0.97);
  if(s.year>=2026)for(let y=Math.max(2027,s.year);y<=s.year+2;y++)generatedYear(s,y);
  familyCasting(s,catalogue,s.year+1);
  const age=s.year-a.birthYear,mortality=age<50?.00015:age<75?.002:age<90?.025:.09;
  if(rand(s)<mortality){die(s,a,rand(s)<.15?'an unexpected illness':'natural causes');return}
 }
 const birthday=`${s.year}-${s.birthday.slice(5)}`;
 if(previous<birthday&&s.date>=birthday){
  const age=ageAt(s.birthday,s.year,s.month,Number(s.date.slice(8)));
  if(age>=5&&age<18)s.timeline.unshift({year:s.year,month:s.month,date:s.date,title:`${a.name} turns ${age}`,body:age<13?'Childhood continues. Explore interests or audition.':'Growing independence brings more choices.'})
 }
 const projectById=new Map([...catalogue,...s.projects].map(p=>[p.id,p]));
 for(const credit of s.filmography.filter(f=>f.personId===a.id&&f.status&&f.status!=='released')){
  const project=projectById.get(credit.projectId);
  if(!project)continue;
  const t=projectSchedule(project);
  if(credit.status==='booked'&&s.date>=t.filmingStart){credit.status='filming';s.timeline.unshift({year:s.year,month:s.month,date:s.date,title:`Filming begins: ${project.title}`,body:`You are on set as ${credit.role}. The shoot is scheduled for about ${t.durationWeeks} weeks.`})}
  if(credit.status==='filming'&&s.date>=t.filmingEnd){credit.status='post-production';s.money+=credit.fee||0;s.respect=clamp(s.respect+3,0,100);s.timeline.unshift({year:s.year,month:s.month,date:s.date,title:`Wrapped: ${project.title}`,body:`Filming is complete. Your fee has been paid; the release is still ahead.`})}
  if(credit.status==='post-production'&&s.date>=t.releaseDate){credit.status='released';s.fame=clamp(s.fame+pick(s,[3,5,8,10]),0,100);a.fame=s.fame;s.timeline.unshift({year:s.year,month:s.month,date:s.date,title:`Released: ${project.title}`,body:`Audiences can now see your performance as ${credit.role}.`})}
 }
 if(rand(s)<.04){const event=pick(s,[{title:'An unexpected invitation',body:'A friend invites you to a small industry gathering.',effect:'social'},{title:'A quiet week',body:'Time to rest, practice, or connect with the people around you.',effect:'rest'},{title:'Under the weather',body:'A passing illness disrupts your plans.',effect:'health'}]);s.notifications.push(event)}
 if(s.fame>30&&rand(s)<.025)s.notifications.push({title:'Recognised in public',body:'Someone spots you while you are out. Fame is starting to affect ordinary life.',effect:'fame'});
 if(s.timeline.length>250)s.timeline=s.timeline.slice(0,250)
}
export function eventChoice(s,e,choice){if(e.effect==='health')s.health=clamp(s.health-(choice==='engage'?5:2),5,100);else if(e.effect==='rest')s.health=clamp(s.health+5,5,100);else if(e.effect==='social'&&choice==='engage')s.fame=clamp(s.fame+1,0,100);else if(e.effect==='fame'&&choice==='engage')s.fame=clamp(s.fame+1,0,100);s.timeline.unshift({year:s.year,month:s.month,title:e.title,body:`${e.body} You chose to ${choice==='engage'?'engage':'keep to yourself'}.`});s.notifications.shift()}
export function connect(s,name,kind,catalogue=[]){
 const a=active(s),p=s.people.find(x=>x.name===name);
 if(!p||p.id===a.id||!p.alive)return false;
 const date=currentDate(s),adult=ageAt(s.birthday,s.year,s.month,Number(date.slice(8)))>=18&&ageAt(p.birthDate||`${p.birthYear}-01-01`,s.year,s.month,Number(date.slice(8)))>=18;
 if(['date','flirt','hookup'].includes(kind)&&(!adult||p.relative||a.relative==='Child'&&p.id===a.id))return false;
 if(kind==='set'&&!filmingProjects(s,catalogue).some(project=>project.roles.some((r,i)=>castFor(s,project,i)===name)))return false;
 const budget=s.socialActions??={week:date,used:0,people:[]};
 if(budget.week!==date){budget.week=date;budget.used=0;budget.people=[]}
 if(budget.used>=2||budget.people.includes(name))return false;
 const r=s.relationships[name]??={friendship:0,respect:0,chemistry:0,dating:false};
 if(kind==='hookup'&&r.chemistry<35)return false;
 if(kind==='date'&&r.chemistry<12)return false;
 if(kind==='flirt'&&r.friendship<10)return false;
 if(kind==='hookup'||kind==='date'){
  const chance=clamp((r.chemistry+(r.friendship||0)+25)/150,.2,.9);
  if(rand(s)>chance){budget.used++;budget.people.push(name);s.socialActions=budget;s.timeline.unshift({year:s.year,month:s.month,date,title:`A moment with ${name}`,body:`${name} is not interested right now. You respect their answer.`});return true}
 }
 budget.used++;budget.people.push(name);s.socialActions=budget;
 if(kind==='date'){r.dating=true;r.friendship=clamp(r.friendship+12,-100,100);r.chemistry=clamp(r.chemistry+9,0,100)}
 else if(kind==='hookup'){r.chemistry=clamp(r.chemistry+12,0,100);r.friendship=clamp(r.friendship+3,-100,100)}
 else if(kind==='flirt'){r.chemistry=clamp(r.chemistry+12,0,100);r.friendship=clamp(r.friendship+2,-100,100)}
 else{r.friendship=clamp(r.friendship+(kind==='set'?9:6),-100,100);r.chemistry=clamp(r.chemistry+(kind==='set'?5:3),0,100)}
 p.relationship=r.friendship;
 const title={date:`A date with ${name}`,hookup:`A private night with ${name}`,flirt:`Sparks with ${name}`,set:`Between takes with ${name}`,friend:`Time with ${name}`}[kind];
 const body={date:'A possible romance begins in this fictional timeline.',hookup:'You both choose to spend the night together. What happens next is yours to decide.',flirt:'The connection feels mutual.',set:'You share a break on set and get to know each other.',friend:'You become a little closer.'}[kind];
 s.timeline.unshift({year:s.year,month:s.month,date,title,body});return true
}
export const shop=[{id:'wardrobe',name:'Premiere wardrobe',price:2000,minAge:16},{id:'car',name:'Car',price:18000,minAge:17},{id:'flat',name:'City apartment',price:120000,minAge:18},{id:'home',name:'Hillside house',price:850000,minAge:18}];
export function buy(s,id){const item=shop.find(x=>x.id===id);if(!item)throw new Error('Unknown purchase.');if(ageAt(s.birthday,s.year,s.month)<item.minAge)throw new Error('You are too young for this purchase.');if(s.money<item.price)throw new Error('You do not have enough money yet.');s.possessions??=[];s.possessions.push({id:item.id,name:item.name,year:s.year,ownerId:s.activeId});s.money-=item.price;if(item.id==='wardrobe')s.fame=clamp(s.fame+1,0,100);s.timeline.unshift({year:s.year,month:s.month,title:'A new purchase',body:`${active(s).name} bought ${item.name.toLowerCase()}.`})}
export function datingApp(s){if(s.year<2012||ageAt(s.birthday,s.year,s.month)<18)throw new Error('Dating apps are unavailable in this era or at this age.');const name=uniqueName(s,'person');const p=person(s,name,'Other',s.year-pick(s,[20,23,27,31,35]),'',pick(s,['female','male','nonbinary']));s.timeline.unshift({year:s.year,month:s.month,title:'A new connection',body:`You matched with ${name}. You can get to know them in People.`});return p}
export function haveChild(s,name,gender='unspecified'){const a=active(s);if(ageAt(s.birthday,s.year,s.month)<18)throw new Error('Your character is too young.');name=name.trim();if(!name||s.usedPeople.includes(name))throw new Error('Choose a unique name for the child.');const p=person(s,name,'Child',s.year,'Child',gender);p.birthDate=`${s.year}-${String(s.month).padStart(2,'0')}-01`;s.children.push(p.id);s.timeline.unshift({year:s.year,month:s.month,title:`Welcome, ${name}`,body:`A new generation joins the family. You can switch to them from age four.`});return p}
export function switchTo(s,id){const p=s.people.find(x=>x.id===id);if(!p||!p.alive||ageAt(p.birthDate||`${p.birthYear}-${s.birthday.slice(5)}`,s.year,s.month)<4)throw new Error('This family member cannot be played yet.');const former=active(s);former.fame=s.fame;s.activeId=id;s.birthday=p.birthDate||`${p.birthYear}-${s.birthday.slice(5)}`;s.skills={acting:8,comedy:5,drama:5};s.fame=p.fame??clamp(Math.round(former.fame*.18),0,100);s.timeline.unshift({year:s.year,month:s.month,title:'A new point of view',body:`You now live as ${p.name}. The previous character stays in the world.`})}
export function die(s,p,cause){const wasActive=p.id===s.activeId;if(wasActive)p.fame=s.fame;p.alive=false;const famous=(p.fame||0)>=45;const close=s.children.map(id=>s.people.find(x=>x.id===id)).filter(x=>x?.alive&&s.year-x.birthYear>=4);const headline=famous?`Hollywood mourns ${p.name}`:`Remembering ${p.name}`;const collaborator=s.filmography.find(f=>f.personId===p.id)?.director;const notice={year:s.year,name:p.name,headline,medium:s.year<1985?'Newspaper':s.year<2010?'Television and newspaper':'Social media and news',body:`${p.name} has died at ${s.year-p.birthYear} from ${cause}. ${famous?'Tributes reflect a career that touched audiences across generations.':'Family and friends remember their life.'}`,tributes:collaborator?[`${collaborator} remembers working with ${p.name} on set. (Fictional in-game tribute)`]:[],career:s.filmography.filter(f=>f.personId===p.id).map(f=>f.title)};s.deathNotices.unshift(notice);s.timeline.unshift({year:s.year,month:s.month,title:headline,body:notice.body});if(wasActive){if(close.length)switchTo(s,close[0].id);else s.complete=true}return notice}
export function castFor(s,p,index){return s.casts[`${p.id}:${index}`]||p.roles[index].actor}
export function directorFor(s,p){return s.directors[p.id]||p.director}
