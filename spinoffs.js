// v1.6 spin-offs, revivals and legacy sequels. Every production created here is
// an explicitly fictional, alternate-timeline project owned by this save.
import {active,currentDate,uniqueName} from './engine.js?v=17';
import {characterKey,makeOffer,careerProfile} from './career.js?v=17';
import {personAge} from './relationships.js?v=17';
import {plusDays,daysBetween,random,ensureOverhaul,offeredFee} from './game-rules.js?v=17';

const all=(s,c)=>[...new Map([...c,...s.projects].map(p=>[p.id,p])).values()];
const find=(s,c,id)=>all(s,c).find(p=>p.id===id);
const generic=key=>!key||/^(self|himself|herself|uncredited|voice|man|woman|guard|extra|narrator)( \d+)?$/.test(key)||key.length<3;

export function ensureSpinoffs(s){s.spinoffs??={history:[],lastCheck:null};return s.spinoffs}

// A fictional production with honest, dated filming windows starting from today.
export function createContinuation(s,{parent,character,kind,label,source,weeksToFilming=8,filmingWeeks,episodes=10,seriesId=null,seasonNumber=1,titleOverride=null}){
 const today=currentDate(s),actor=active(s),castingStart=today,filmStart=plusDays(today,weeksToFilming*7),filmEnd=plusDays(filmStart,(filmingWeeks||(kind==='TV series'?16:12))*7),release=plusDays(filmEnd,kind==='TV series'?90:150),year=Number(release.slice(0,4));
 const age=personAge(s,actor),parentYear=parent?.year||year-1,gap=year-parentYear;
 const lead={character,actor:actor.name,gender:actor.gender,birthYear:actor.birthYear,characterAge:age,ageMin:Math.max(4,age-8),ageMax:age+8,roleType:kind==='TV series'?'main':undefined,episodeCount:kind==='TV series'?episodes:undefined};
 const support=(parent?.roles||[]).filter(r=>characterKey(r.character)!==characterKey(character)&&!generic(characterKey(r.character))).slice(0,6).map(r=>({...r,characterAge:r.characterAge==null?undefined:r.characterAge+gap,ageMin:Math.max(4,(r.ageMin||18)+gap),ageMax:(r.ageMax||60)+gap,roleType:kind==='TV series'?'recurring':r.roleType,episodeCount:kind==='TV series'?Math.max(2,Math.round(episodes*.6)):undefined}));
 const id=`${source}-${s.nextId++}`,title=titleOverride||label;
 const p={id,title,year,kind,director:parent?.director||uniqueName(s,'person'),genre:parent?.genre||'Drama',roles:[lead,...support],generated:true,franchiseContinuation:true,alternateSeason:true,continuationOf:parent?.id||null,continuationType:source,castingStartDate:castingStart,filmingStartDate:filmStart,filmingEndDate:filmEnd,releaseDate:release,voteCount:Math.round((parent?.voteCount||800)*(source==='revival'?.8:source==='legacy-sequel'?.9:.55)),popularity:Math.round((parent?.popularity||20)*.7),baselineRating:Math.max(5,(parent?.baselineRating||6.4)-(source==='spinoff'?.3:.2)),budget:parent?.budget?Math.round(parent.budget*(source==='legacy-sequel'?1.3:.8)):undefined};
 if(kind==='TV series'){p.seriesId=seriesId||id;p.seriesTitle=title.replace(/ · .*$/,'');p.seasonNumber=seasonNumber;p.episodeCount=episodes}
 s.projects.push(p);if(!s.usedTitles.includes(p.title))s.usedTitles.push(p.title);
 return p;
}

function offerContinuation(s,p,source,{premium=1.4}={}){
 const fee=Math.round(offeredFee(s,p,0)*premium);
 const offer=makeOffer(s,p,0,{source,fee,expiresOn:plusDays(currentDate(s),35)});
 ensureSpinoffs(s).history.push({date:currentDate(s),type:source,projectId:p.id,title:p.title,character:p.roles[0].character,offerId:offer.id});
 return offer;
}

// Spin-off: a beloved TV character gets their own show.
export function spinoffCandidates(s,catalogue){
 const sp=ensureSpinoffs(s),done=new Set(sp.history.filter(h=>h.type==='spinoff').map(h=>h.character));
 return (s.tvCareers||[]).filter(c=>c.personId===s.activeId&&c.fans>=68&&!done.has(c.character)&&!generic(c.characterKey)&&['active','ended','written-out','left'].includes(c.status));
}
export function revivalCandidates(s,catalogue){
 const sp=ensureSpinoffs(s),done=new Set(sp.history.filter(h=>h.type==='revival').map(h=>h.seriesId||h.character));
 return (s.tvCareers||[]).filter(c=>{if(c.personId!==s.activeId||!['ended','written-out','left'].includes(c.status)||done.has(c.seriesId)||generic(c.characterKey))return false;const credit=s.filmography.find(f=>f.projectId===c.lastProjectId&&f.personId===s.activeId);return credit&&credit.status==='released'&&s.year-credit.year>=6&&(c.fans>=45||s.fame>=55)});
}
export function legacySequelCandidates(s,catalogue){
 const sp=ensureSpinoffs(s),done=new Set(sp.history.filter(h=>h.type==='legacy-sequel').map(h=>h.character));
 return s.filmography.filter(f=>f.personId===s.activeId&&f.kind==='Film'&&f.status==='released'&&f.outcome&&f.outcome.commercial>=65&&s.year-f.year>=10&&!done.has(f.role)&&!generic(characterKey(f.role)));
}
export function filmSpinoffCandidates(s){
 const sp=ensureSpinoffs(s),done=new Set(sp.history.map(h=>h.character)),profile=ensureOverhaul(s);
 return Object.values(profile.identities||{}).filter(i=>i.strength>=60&&i.productions>=2&&!done.has(i.character)&&!generic(characterKey(i.character)));
}

export function launchSpinoff(s,catalogue,career){
 const parent=find(s,catalogue,career.lastProjectId)||{title:career.title,roles:[],year:s.year-1};
 const kind=random(s)<.8?'TV series':'Film';
 const name=String(career.character).replace(/\s*\(.*?\)\s*/g,'').trim();
 const p=createContinuation(s,{parent,character:career.character,kind,source:'spinoff',label:kind==='TV series'?`${name}`:`${name}: The Movie`});
 return offerContinuation(s,p,'spinoff',{premium:1.6});
}
export function launchRevival(s,catalogue,career){
 const parent=find(s,catalogue,career.lastProjectId)||{title:career.title,roles:[],year:s.year-8};
 const p=createContinuation(s,{parent,character:career.character,kind:'TV series',source:'revival',label:`${career.title} · Revival`,seriesId:career.seriesId,seasonNumber:(career.lastSeason||1)+1,episodes:8});
 const offer=offerContinuation(s,p,'revival',{premium:1.5});ensureSpinoffs(s).history.at(-1).seriesId=career.seriesId;return offer;
}
export function launchLegacySequel(s,catalogue,credit){
 const parent=find(s,catalogue,credit.projectId)||{title:credit.title,roles:[],year:credit.year,genre:credit.genre};
 const p=createContinuation(s,{parent,character:credit.role,kind:'Film',source:'legacy-sequel',label:`${credit.title}: Legacy`,filmingWeeks:14});
 if(parent.collectionId)p.collectionId=parent.collectionId;
 return offerContinuation(s,p,'legacy-sequel',{premium:1.8});
}
export function launchFilmSpinoff(s,catalogue,identity){
 const name=String(identity.character).replace(/\s*\(.*?\)\s*/g,'').trim();
 const parent=all(s,catalogue).find(p=>p.roles.some(r=>r.character===identity.character)&&s.filmography.some(f=>f.personId===s.activeId&&f.projectId===p.id))||null;
 const p=createContinuation(s,{parent,character:identity.character,kind:'Film',source:'spinoff',label:`${name}`});
 return offerContinuation(s,p,'spinoff',{premium:1.6});
}

// Roughly monthly: maybe one continuation, never stacking several at once.
export function spinoffTick(s,catalogue){
 const sp=ensureSpinoffs(s),date=currentDate(s);if(s.complete)return null;
 if(sp.lastCheck&&daysBetween(sp.lastCheck,date)<28)return null;sp.lastCheck=date;
 if(personAge(s,active(s))<16)return null;
 if(sp.history.some(h=>daysBetween(h.date,date)<240))return null;
 if((s.roleOffers||[]).some(o=>o.personId===s.activeId&&o.status==='offered'&&['spinoff','revival','legacy-sequel'].includes(o.source)))return null;
 const reputation=careerProfile(s).reputation||50,boost=1+Math.max(0,(s.fame-50)/100)+Math.max(0,(reputation-60)/200);
 const tv=spinoffCandidates(s,catalogue);if(tv.length&&random(s)<.07*boost)return launchSpinoff(s,catalogue,tv.sort((a,b)=>b.fans-a.fans)[0]);
 const revival=revivalCandidates(s,catalogue);if(revival.length&&random(s)<.04*boost)return launchRevival(s,catalogue,revival[0]);
 const sequel=legacySequelCandidates(s,catalogue);if(sequel.length&&random(s)<.035*boost)return launchLegacySequel(s,catalogue,sequel[0]);
 const film=filmSpinoffCandidates(s);if(film.length&&random(s)<.03*boost)return launchFilmSpinoff(s,catalogue,film[0]);
 return null;
}
export const continuationSources=['spinoff','revival','legacy-sequel'];
