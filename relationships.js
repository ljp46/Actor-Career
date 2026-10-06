// Relationship events are fictional within the player's save.
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const date=s=>s.date||`${s.year}-${String(s.month).padStart(2,'0')}-28`;
const roll=s=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296};
export function personAge(s,p){const birthday=p.id===s.activeId?s.birthday:p.birthDate||`${p.birthYear}-01-01`,d=date(s);return Number(d.slice(0,4))-Number(birthday.slice(0,4))-(d.slice(5)<birthday.slice(5)?1:0)}
export function romanceAllowed(s,p,{adult=false}={}){const a=s.people.find(p=>p.id===s.activeId);if(!a?.alive||!p?.alive||s.complete||a.id===p.id||p.relative||a.relative==='Child'&&p.id==='self')return false;const x=personAge(s,a),y=personAge(s,p);return adult?x>=18&&y>=18:x>=13&&y>=13&&(x>=18&&y>=18||x<18&&y<18&&Math.abs(x-y)<=2)}
export function ensureRelationships(s){
 s.relationshipProfiles??={};
 if(!s.relationshipOwner)s.relationshipOwner=s.activeId;
 if(s.relationshipOwner!==s.activeId){s.relationshipProfiles[s.relationshipOwner]=s.relationships||{};s.relationships=s.relationshipProfiles[s.activeId]||{};s.relationshipOwner=s.activeId}
 s.relationships??={};delete s.relationshipProfiles[s.activeId];
 s.socialInvitations??=[];s.energy??=100;
 return s.relationships;
}
export function personality(p){if(!p.socialPersonality){let h=0;for(const c of p.name)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;p.socialPersonality={style:['Thoughtful','Adventurous','Reserved','Ambitious'][h%4],preference:['walk','outing','chat','career'][Math.floor(h/4)%4],commitment:35+h%61,privacy:h%3!==0}}return p.socialPersonality}
export function bond(s,p){ensureRelationships(s);const r=s.relationships[p.name]??={friendship:p.relative?65:0,respect:0,chemistry:0,dating:false};r.memories??=[];r.commitment??=r.dating?35:0;r.status??=r.dating?'dating':'acquaintance';r.public??=false;r.tension??=0;personality(p);return r}
function memory(s,p,r,title,body,log=true){r.memories.unshift({date:date(s),title,body});r.memories.length=Math.min(r.memories.length,32);if(log)s.timeline.unshift({year:s.year,month:s.month,date:date(s),title:`${title} · ${p.name}`,body});s.timeline.length=Math.min(s.timeline.length,250)}
export function relationshipStatus(s,p){const r=bond(s,p);return p.relative||(!p.alive?'Remembered':r.dating?(r.status==='committed'?'Partners':'Dating'):r.status==='ex'?'Former partner':p.rivalry>=35?'Rival':r.friendship>=70?'Close friend':r.friendship>=30?'Friend':'Acquaintance')}
export function interactionReason(s,p,kind){
 if(!p?.alive||p.id===s.activeId||s.complete)return 'This person is unavailable.';
 const r=bond(s,p);
 if(['flirt','date','commit','reconcile'].includes(kind)&&!romanceAllowed(s,p))return 'Dating starts at 13, with close-age matches for teenagers.';
 if(kind==='hookup'&&!romanceAllowed(s,p,{adult:true}))return 'Private nights are available only between unrelated adults.';
 if(['flirt','date','hookup','commit','reconcile'].includes(kind)&&r.spaceUntil>date(s))return 'They asked for space. You can still have an ordinary conversation.';
 if(['date','hookup','reconcile','commit'].includes(kind)&&Object.entries(s.relationships).some(([name,b])=>name!==p.name&&b.dating&&b.status==='committed'))return 'You are in an exclusive relationship. End it before pursuing someone else.';
 if(['date','outing','walk','hookup'].includes(kind)&&p.busyUntil>date(s))return 'They are busy with work. Try a conversation or come back after their shoot.';
 if(kind==='commit'&&!r.dating)return 'Start dating before discussing commitment.';
 if(kind==='commit'&&r.status==='committed')return 'You have already agreed to be exclusive.';
 if(kind==='breakup'&&!r.dating)return 'You are not dating.';
 if(kind==='reconcile'&&r.status!=='ex')return 'There is no former romance to revisit.';
 if(kind==='public'&&!r.dating)return 'Start a relationship before discussing publicity.';
 if(kind==='hookup'&&r.chemistry<35)return 'Build mutual chemistry first (35 or higher).';
 if(['date','outing','walk','hookup'].includes(kind)&&s.energy<20)return 'You need 20 energy. Rest or advance time.';
 if(['date','outing','hookup'].includes(kind)&&s.money<(s.year<1980?5:s.year<2000?20:40))return 'You need money for this outing. A walk is free.';
 return '';
}
export function interact(s,p,kind,{onSet=false}={}){
 if(!['friend','chat','set','flirt','date','hookup','walk','outing','career','commit','breakup','reconcile','public','apologise'].includes(kind)||interactionReason(s,p,kind)||kind==='set'&&!onSet)return false;
 const r=bond(s,p),traits=personality(p),d=date(s);
 if(!r.met){r.met=d;memory(s,p,r,'First conversation','You begin getting to know each other.')}
 const small=['friend','chat','set','flirt','career','apologise'].includes(kind);
 if(r.chatDate!==d){r.chatDate=d;r.chats=0}
 const gain=r.chats<3?(kind==='set'?9:6):r.chats<7?2:0;
 if(small)r.chats++;
 if(['date','hookup','commit','reconcile','flirt'].includes(kind)){
  const chance=kind==='flirt'?clamp((r.friendship+35)/120,.2,.85):kind==='commit'?clamp((r.friendship+r.commitment+traits.commitment-r.tension)/240,.1,.9):clamp((r.chemistry+r.friendship+25-r.tension)/160,.15,.9);
  if(roll(s)>chance){r.spaceUntil=new Date(Date.parse(d+'T12:00:00Z')+7*86400000).toISOString().slice(0,10);memory(s,p,r,'A boundary respected',`${p.name} is not interested right now and asks for some space.`);return true}
 }
 if(['date','outing','walk','hookup'].includes(kind)){s.energy-=20;if(kind!=='walk')s.money-=s.year<1980?5:s.year<2000?20:40;r.friendship=clamp(r.friendship+8+(traits.preference===kind?4:0),-100,100);r.tension=clamp(r.tension-12);r.lastQuality=d}
 if(kind==='date'||kind==='reconcile'){r.dating=true;r.status='dating';r.chemistry=clamp(r.chemistry+8);r.commitment=clamp(r.commitment+10)}
 else if(kind==='hookup'){r.chemistry=clamp(r.chemistry+10)}
 else if(kind==='commit'){r.status='committed';r.commitment=clamp(r.commitment+20)}
 else if(kind==='breakup'){r.dating=false;r.status='ex';r.commitment=0;r.tension=clamp(r.tension+20);r.spaceUntil=new Date(Date.parse(d+'T12:00:00Z')+21*86400000).toISOString().slice(0,10)}
 else if(kind==='public'){if(traits.privacy&&!r.public&&r.commitment<40){memory(s,p,r,'Keeping things private','Your partner prefers privacy until the relationship feels more secure.');return true}r.public=!r.public}
 else if(kind==='apologise'){r.tension=clamp(r.tension-Math.min(gain,3));r.friendship=clamp(r.friendship+Math.min(gain,2),-100,100);p.rivalry=clamp((p.rivalry||0)-Math.min(gain,3))}
 else if(small){r.friendship=clamp(r.friendship+gain,-100,100);if(kind==='career'||kind==='set')r.respect=clamp(r.respect+Math.min(gain,3));if(kind==='flirt')r.chemistry=clamp(r.chemistry+Math.min(gain,6));if(kind==='friend'||kind==='set')r.chemistry=clamp(r.chemistry+Math.min(gain,3))}
 if(r.dating&&['walk','outing'].includes(kind))r.commitment=clamp(r.commitment+5);
 p.relationship=r.friendship;
 const titles={friend:'A conversation',chat:'A conversation',set:'Between takes',flirt:'A shared spark',date:'A first or next date',hookup:'A private night',walk:'A walk together',outing:'Time away together',career:'Talking about work',commit:'An exclusive relationship',breakup:'A relationship ends',reconcile:'Trying again',public:r.public?'Going public':'Choosing privacy',apologise:'Clearing the air'};
 const stories={date:r.dating&&r.commitment>10?'You make time for another date, away from auditions and deadlines.':'A nervous first date ends with plans to see each other again.',hookup:'You both choose a private evening together. Neither of you assumes it means a lasting commitment.',walk:traits.preference==='walk'?'An unhurried walk gives you space to talk about things you rarely share.':'A walk and an easy conversation give you some time away from work.',outing:traits.preference==='outing'?'Trying somewhere new brings out their adventurous side.':'A shared outing gives you a memory beyond the set.',commit:'You discuss what you both want and agree to an exclusive relationship.',breakup:'You choose to end the romance. The shared history remains, and friendship may still be possible.',reconcile:'You agree to try again, knowing trust will need time to grow.',public:r.public?'You both agree to let people know about the relationship.':'You agree to keep the relationship out of the spotlight.'};
 memory(s,p,r,titles[kind],small?(gain?(kind==='career'?'You share stories about work and understand each other a little better.':kind==='flirt'?'The teasing is gentle, and the interest feels mutual.':'You find a little more common ground.'):'You enjoy a familiar conversation. New experiences may bring you closer.'):stories[kind]||'This moment becomes part of your shared story.');
 return true;
}
export function answerInvitation(s,id,answer){ensureRelationships(s);const e=s.socialInvitations.find(e=>e.id===id&&e.personId===s.activeId&&e.expires>=date(s)),p=e&&s.people.find(p=>p.id===e.from);if(!e||!p||!['accept','slow','decline'].includes(answer))return false;const r=bond(s,p);if(answer==='accept'){if(!romanceAllowed(s,p)||interactionReason(s,p,'flirt')||Object.entries(s.relationships).some(([name,b])=>name!==p.name&&b.dating&&b.status==='committed'))return false;r.dating=true;r.status=e.kind==='commit'?'committed':'dating';r.commitment=clamp(r.commitment+10);memory(s,p,r,'An invitation accepted','You both choose to explore this connection.')}else{if(answer==='decline')r.spaceUntil=new Date(Date.parse(date(s)+'T12:00:00Z')+28*86400000).toISOString().slice(0,10);memory(s,p,r,answer==='slow'?'Taking it slowly':'An honest answer',answer==='slow'?'You prefer to keep getting to know each other.':'You kindly decline. Their answer does not cost you friendship.')}s.socialInvitations=s.socialInvitations.filter(x=>x.id!==id);return true}
export function relationshipTick(s,workingNames=[]){
 ensureRelationships(s);const d=date(s),people=new Map(s.people.map(p=>[p.name,p]));if(s.relationshipTickDate===d||s.complete)return;s.relationshipTickDate=d;
 s.socialInvitations=s.socialInvitations.filter(e=>e.expires>=d&&s.people.some(p=>p.id===e.from&&romanceAllowed(s,p)));
 for(const [name,r] of Object.entries(s.relationships)){
  const p=people.get(name);if(!p?.alive)continue;bond(s,p);
  if(!r.met){r.met=d;memory(s,p,r,'A familiar face','Your existing connection continues into this chapter.',false)}
  if(r.dating&&!romanceAllowed(s,p)){r.dating=false;r.status='friends';r.commitment=0;memory(s,p,r,'A new chapter','Your lives now follow different paths. The friendship can continue.');continue}
  if(r.dating){const weeks=(Date.parse(d)-Date.parse(r.lastQuality||r.met))/604800000;if(weeks>4){r.tension=clamp(r.tension+(workingNames.length?3:1));if(weeks>8&&r.tension>=55&&roll(s)<.12){r.dating=false;r.status='ex';r.commitment=0;memory(s,p,r,'Drifting apart','Time apart and unresolved tension have ended the romance. You can still rebuild a friendship.')}else if(weeks%4<1)memory(s,p,r,'Missing time together',workingNames.length?'Your partner misses you during a long shoot. A shared outing could help.':'Your partner wishes you would make more time together.')}
   if(r.public&&s.fame>35&&roll(s)<.04){memory(s,p,r,s.year>=2010?'Relationship in the headlines':'A relationship in the press',s.year>=2010?'Fans discuss your relationship online.':'An entertainment column mentions you together.');if(personality(p).privacy)r.tension=clamp(r.tension+5)}
  }
  if(workingNames.includes(name)&&r.lastSet!==d){r.lastSet=d;r.respect=clamp(r.respect+1);if(romanceAllowed(s,p))r.chemistry=clamp(r.chemistry+1)}
  if(!workingNames.includes(name)&&(!p.busyUntil||p.busyUntil<d)&&personality(p).style==='Ambitious'&&roll(s)<.015)p.busyUntil=new Date(Date.parse(d+'T12:00:00Z')+14*86400000).toISOString().slice(0,10);
  if(s.socialInvitations.filter(e=>e.personId===s.activeId).length<3&&romanceAllowed(s,p)&&r.friendship>=25&&r.chemistry>=15&&(!r.spaceUntil||r.spaceUntil<=d)&&!s.socialInvitations.some(e=>e.from===p.id&&e.personId===s.activeId)&&(!r.dating||r.status!=='committed'&&r.commitment>=30)&&roll(s)<.025&&!interactionReason(s,p,r.dating?'commit':'flirt')&&!Object.entries(s.relationships).some(([name,b])=>name!==p.name&&b.dating&&b.status==='committed')){s.socialInvitations.push({id:`invite-${s.nextId++}`,from:p.id,personId:s.activeId,kind:r.dating?'commit':'date',date:d,expires:new Date(Date.parse(d+'T12:00:00Z')+28*86400000).toISOString().slice(0,10)});memory(s,p,r,r.dating?'An important conversation':'They make the first move',r.dating?'They want to discuss making your relationship exclusive.':'They ask whether you would like to start dating.')}
 }
}
export function recordCollaboration(s,p,project){const r=bond(s,p);r.productions??=[];if(r.productions.includes(project.id))return;r.productions.push(project.id);r.productions=r.productions.slice(-40);memory(s,p,r,r.productions.length>1?'Working together again':'A shared production',`You join the cast of ${project.title}.`,false);if(r.productions.length>1){r.friendship=clamp(r.friendship+3,-100,100);r.respect=clamp(r.respect+3)}}
