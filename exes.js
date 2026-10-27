// v1.8 exes: breakup history, closure, second chances and ex drama. Fictional gameplay.
import {active,currentDate} from './engine.js?v=17';
import {bond,personAge,romanceAllowed,recordBreakup} from './relationships.js?v=17';
import {limit,feed,queueEvent,openLifeEvent,dateOf,plusDays,daysBetween,random,ensureOverhaul} from './game-rules.js?v=17';
import {exclusivePartners,isTaken,noteCheating} from './vice.js?v=17';
import {nudge} from './life.js?v=17';

const roll=s=>random(s);
const choice=(id,label)=>({id,label});
const EX=['ex','divorced'];
const months=(a,b)=>Math.max(0,Math.round(daysBetween(a,b)/30.44));
const fmtMonth=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
const remember=(s,p,title,body)=>{const r=bond(s,p);r.memories.unshift({date:dateOf(s),title,body});r.memories.length=Math.min(r.memories.length,32);feed(s,`${title} · ${p.name}`,body)};

export const isEx=(s,p)=>EX.includes(bond(s,p).status)&&!bond(s,p).dating;
export function lastBreakup(r){return (r.breakups||[]).at(-1)||null}
// A plain-English summary of your history with an ex, for popups and their profile.
export function exHistory(s,p){
 const r=bond(s,p),b=lastBreakup(r),times=Math.max(1,r.timesTogether||1),since=b?months(b.date,dateOf(s)):null;
 const who=!b?'You split up':b.by==='them'?`${p.name} ended it`:b.by==='you'?'You ended it':'You drifted apart';
 return {times,since,by:b?.by||'unknown',reason:b?.reason||'',closure:Math.round(r.closure||0),lingering:Math.round(((r.chemistry||0)+(r.affection||0))/2),
  line:`${r.status==='divorced'?'Divorced. ':''}${times>1?`Together ${times} times. `:''}${who}${b?.reason?` (${b.reason.replace(/\.$/,'')})`:''}${b?`, ${fmtMonth(b.date)}`:''}.`};
}
function makeTogether(s,p){
 const r=bond(s,p);r.dating=true;r.timesTogether=(r.timesTogether||1)+1;r.datingSince=dateOf(s);r.tension=10;r.trust=Math.max(30,(r.trust||30)-5);r.commitment=Math.max(r.commitment||0,30);r.closure=0;
 if(exclusivePartners(s,p).length){r.affair=true;r.status='affair';noteCheating(s,p,'date')}else{r.affair=false;r.status='dating';p.socialLife={status:'dating',partnerId:s.activeId,partnerName:active(s).name,lastChange:dateOf(s)}}
}

// ------------------------------------------------------------------ actions on an ex's profile
export const exActions={closure:{label:'Meet up for closure',energy:15},latenight:{label:'Text them at 2am',energy:0},block:{label:'Block their number',energy:0}};
export function exActionReason(s,p,kind){
 const r=bond(s,p);if(!isEx(s,p)||!p.alive)return 'Only for an ex.';
 if(exActions[kind].energy&&(s.energy??100)<exActions[kind].energy)return `Needs ${exActions[kind].energy} energy.`;
 if(kind!=='block'&&r.blocked)return 'You blocked them.';
 if(kind==='closure'&&(r.closure||0)>=90)return 'You already have closure.';
 if(kind==='latenight'&&!romanceAllowed(s,p,{adult:true}))return 'Only between two adults.';
 return '';
}
export function exAction(s,p,kind){
 const why=exActionReason(s,p,kind);if(why)throw Error(why);const r=bond(s,p),x=roll(s);
 if(exActions[kind].energy)s.energy-=exActions[kind].energy;
 if(kind==='closure'){if(x<.75){r.closure=limit((r.closure||0)+40);r.friendship=limit(r.friendship+8,-100,100);r.tension=limit((r.tension||0)-20);nudge(s,{happiness:6});remember(s,p,'Closure','You talk honestly about what went wrong. It helps.');return {title:'A good talk',body:`You and ${p.name} talk about what went wrong. You both feel lighter.`}}r.tension=limit((r.tension||0)+10);remember(s,p,'Old wounds','The conversation turns into the same old argument.');return {title:'Old wounds',body:'It turns into the same argument you used to have. Maybe another time.'}}
 if(kind==='latenight'){const flirty=x<limit((r.chemistry||0)/100+.15,.15,.75);if(flirty){r.chemistry=limit((r.chemistry||0)+10);r.closure=limit((r.closure||0)-15);if(exclusivePartners(s,p).length)noteCheating(s,p,'flirt');remember(s,p,'A late-night text','They reply within a minute. The old spark is still there.');return {title:'They replied',body:`${p.name} replies within a minute. The old spark is still there.${exclusivePartners(s,p).length?' Your partner would not love this.':''}`}}nudge(s,{happiness:-4});remember(s,p,'Left on read','Your 2am message is read and never answered.');return {title:'Left on read',body:'Read at 2:04am. No reply. Ouch.'}}
 if(kind==='block'){r.blocked=!r.blocked;if(r.blocked){r.closure=limit((r.closure||0)+20);return {title:'Blocked',body:`${p.name} cannot message you any more.`}}return {title:'Unblocked',body:`${p.name} can message you again.`}}
}

// ------------------------------------------------------------------ weekly ex events
export function exTick(s,catalogue,days=7,{workingNames=[]}={}){
 if(s.complete||openLifeEvent(s))return;const date=dateOf(s),profile=ensureOverhaul(s),weeks=Math.max(1,days/7);
 if(profile.lastExEvent&&daysBetween(profile.lastExEvent,date)<42)return;
 const exes=s.people.filter(p=>p.alive&&p.id!==s.activeId&&s.relationships?.[p.name]&&isEx(s,p));if(!exes.length)return;
 const fire=(...args)=>{const e=queueEvent(s,...args);if(e)profile.lastExEvent=date;return e};
 for(const p of exes){
  const r=bond(s,p),h=exHistory(s,p),b=lastBreakup(r),since=b?daysBetween(b.date,date):999;
  // working on set with an ex
  if(workingNames.includes(p.name)&&r.lastSetWith!==currentDate(s).slice(0,7)&&roll(s)<.4){r.lastSetWith=currentDate(s).slice(0,7);return fire('ex','Awkward on set',`Your ex ${p.name} is in the cast. ${h.line} Everyone on set knows it.`,[choice('professional','Keep it strictly professional'),choice('rekindle','Let the old chemistry show'),choice('avoid','Avoid them between takes')],{kind:'set',personId:p.id})}
  if(r.blocked)continue;
  // they want you back: needs time, lingering feelings and nobody else in their life
  const adult=romanceAllowed(s,p);
  if(adult&&since>=60&&!isTaken(s,p)&&h.lingering>=20&&(r.closure||0)<80&&(!r.noSecondChance||r.noSecondChance<=date)){
   const regret=b?.by==='them'?.035:.02;
   if(roll(s)<regret*weeks*(1+h.lingering/100)/(1+(h.times-1)*.6)){
    r.exPitch={sincere:roll(s)<limit(.45+(r.trust||30)/200-(h.times-1)*.12,.15,.85),date};
    return fire('ex',`${p.name} wants you back`,`${h.line} ${b?.by==='them'?`${p.name} says breaking up was a mistake.`:`${p.name} has been thinking about you a lot.`} Now they are asking for another chance.${exclusivePartners(s,p).length?` You are with ${exclusivePartners(s,p)[0].name} now.`:''}`,[choice('reconcile','Get back together'),choice('why','Ask what has changed'),choice('friends','Offer friendship instead'),choice('no','It is over for good'),...(b?.by==='them'&&romanceAllowed(s,p,{adult:true})?[choice('payback','Say yes, then dump them')]:[])],{kind:'pitch',personId:p.id});
   }
  }
  // they move on
  if(isTaken(s,p)&&!r.sawNewPartner&&p.socialLife?.lastChange>(b?.date||'')){r.sawNewPartner=true;if(roll(s)<.7)return fire('ex',`${p.name} has moved on`,`Your ex ${p.name} is now with ${p.socialLife.partnerName||'someone new'}.${s.fame>=40||(p.fame||0)>=40?' The photos are everywhere.':''}`,[choice('happy','Be happy for them'),choice('jealous','Send a jealous message'),choice('ignore','Do not look at the photos')],{kind:'moved-on',personId:p.id})}
  // they talk about you in public
  if(((p.fame||0)>=40||s.fame>=40)&&b?.by==='you'&&r.friendship<20&&!r.toldAll&&since>=30&&roll(s)<.02*weeks){r.toldAll=true;return fire('ex',`${p.name} talks about you`,`In a new interview, ${p.name} talks about your breakup. It is not flattering.`,[choice('respond','Hit back publicly'),choice('highroad','Take the high road'),choice('laugh','Joke about it on social media')],{kind:'interview',personId:p.id})}
  // a quieter moment: closure
  if(since>=120&&(r.closure||0)<50&&r.friendship>=0&&roll(s)<.012*weeks)return fire('ex','A message from an ex',`${p.name} asks if you could meet for a coffee and finally talk about what happened.`,[choice('meet','Meet them'),choice('decline','Leave the past in the past')],{kind:'closure',personId:p.id});
 }
}
export function resolveEx(s,catalogue,e,answer){
 const p=s.people.find(x=>x.id===e.data?.personId);if(!p)return '';const r=bond(s,p),x=roll(s),life=ensureOverhaul(s),k=e.data.kind;
 if(k==='pitch'||k==='pitch-2'){
  if(answer==='reconcile'){
   const sticks=r.exPitch?.sincere;makeTogether(s,p);r.secondChanceSincere=sticks;if(!sticks)r.tension=limit(r.tension+25);nudge(s,{happiness:8});remember(s,p,'Back together',`You give it another go. This is time number ${r.timesTogether}.`);
   return `You and ${p.name} are back together.${r.affair?' It is an affair for now, as you are still with someone else.':''}${r.timesTogether>=3?' Your friends are taking bets on how long it lasts.':''}`;
  }
  if(answer==='why'){const sincere=r.exPitch?.sincere,why=sincere?pickWhy(s,true):pickWhy(s,false);queueEvent(s,'ex',`What ${p.name} says`,`"${why}"\n\n${sincere?'They mean it. You can tell.':'Something about it feels rehearsed.'}`,[choice('reconcile','Give it another chance'),choice('friends','Offer friendship instead'),choice('no','It is over for good')],{kind:'pitch-2',personId:p.id});return ''}
  if(answer==='friends'){r.closure=limit((r.closure||0)+30);r.friendship=limit(r.friendship+5,-100,100);r.chemistry=limit((r.chemistry||0)-10);return `${p.name} takes it well. Friends it is.`}
  if(answer==='payback'){makeTogether(s,p);r.dating=false;r.affair=false;r.status='ex';r.friendship=limit(r.friendship-40,-100,100);r.closure=limit((r.closure||0)+50);r.noSecondChance=plusDays(dateOf(s),730);recordBreakupFor(s,r,'you','payback');nudge(s,{happiness:6});const extra=s.fame>=35||(p.fame||0)>=40?(life.publicImage=limit(life.publicImage-4),' The story leaks, and the internet is split on whether you are a hero or a villain.'):'';remember(s,p,'Payback','You say yes, then end it a week later.');return `A week later, you end it. Now ${p.name} knows how it feels.${extra}`}
  r.closure=limit((r.closure||0)+40);r.chemistry=limit((r.chemistry||0)-20);r.noSecondChance=plusDays(dateOf(s),365);return `You tell ${p.name} it is over for good. They will not ask again for a long time.`;
 }
 if(k==='set'){
  if(answer==='professional'){r.respect=limit((r.respect||0)+6);r.closure=limit((r.closure||0)+10);return 'You keep it professional. The crew is impressed, and a little disappointed.'}
  if(answer==='rekindle'){r.chemistry=limit((r.chemistry||0)+15);r.friendship=limit(r.friendship+5,-100,100);if(exclusivePartners(s,p).length)noteCheating(s,p,'flirt');return `The old chemistry is back, on camera and off. ${p.name} lingers after every scene.`}
  r.tension=limit((r.tension||0)+5);return 'You eat lunch in your trailer every day. It is a long shoot.';
 }
 if(k==='moved-on'){
  if(answer==='happy'){r.closure=limit((r.closure||0)+25);nudge(s,{happiness:2});return 'You mean it, mostly.'}
  if(answer==='jealous'){if(x<.3&&romanceAllowed(s,p,{adult:true})){r.chemistry=limit((r.chemistry||0)+10);return `${p.name} replies: "Do not do this to me." The door is not entirely closed.`}r.friendship=limit(r.friendship-10,-100,100);nudge(s,{happiness:-4});return `${p.name} does not reply. Their new partner might have seen it.`}
  nudge(s,{happiness:-2});return 'You mute them everywhere. Out of sight, mostly out of mind.';
 }
 if(k==='interview'){
  if(answer==='respond'){life.publicImage=limit(life.publicImage-4);s.fame=limit(s.fame+1);r.friendship=limit(r.friendship-15,-100,100);return 'Your reply goes viral. So does the feud.'}
  if(answer==='laugh'){life.publicImage=limit(life.publicImage+(x<.6?3:-3));return x<.6?'Your joke lands perfectly. You win the internet for a day.':'The joke falls flat and looks bitter.'}
  life.publicImage=limit(life.publicImage+3);return 'You say nothing. People notice, and respect it.';
 }
 if(k==='closure'){if(answer==='meet'){r.closure=limit((r.closure||0)+45);r.friendship=limit(r.friendship+10,-100,100);nudge(s,{happiness:5});return 'You finally say the things you never said. It feels like the end of a chapter.'}return 'You leave it unread. Some doors stay closed.'}
 return '';
}
function pickWhy(s,sincere){const good=['I have been in therapy. I understand now what I did wrong.','I dated other people and none of them were you.','I was scared of how serious it was getting. I am not scared now.','I have changed my priorities. You come first this time.'],bad=['I just miss having someone, you know?','My new thing did not work out, so I thought of you.','You were always the safe option.','Everyone says we looked great together.'];const list=sincere?good:bad;return list[Math.floor(roll(s)*list.length)]}
export const recordBreakupFor=recordBreakup;
