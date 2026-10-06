const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
(async()=>{
 const index=JSON.parse(fs.readFileSync('data/filmographies/index.json'));
 const projects=index.years.flatMap(y=>JSON.parse(gunzipSync(fs.readFileSync(`data/filmographies/years/${y}.json.gz`))).projects);
 const series=Object.values(index.shows).find(s=>s.title==='Stuck in the Middle');
 assert.ok(series,'Requested Disney series is permanently present');
 const project=projects.find(p=>p.seriesId===series.id&&p.seasonNumber===1);
 assert.ok(project.roles.some(r=>r.personId===974169),'Jenna is in the real first-season cast');
 assert.ok(project.roles.some(r=>r.personId===1767250),'Ariana shares the same production');
 const browser=await chromium.launch(),page=await browser.newPage({serviceWorkers:'block'}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/filmographies/years/'))requests.push(r.url())});
 await page.goto('http://127.0.0.1:8765');await page.locator('#name').waitFor();
 await page.evaluate(async p=>{
  const e=await import('./engine.js?v=13'),r=p.roles.find(r=>r.personId===974169),t=e.projectSchedule(p);
  const s=e.createCareer({name:'Filmography Test',birthday:`${r.birthYear}-01-01`,startDate:t.castingStart,gender:r.gender},[]);
  s.skills.acting=100;localStorage.setItem(e.SAVE_KEY,JSON.stringify(s));
 },project);
 await page.reload();await page.locator('#auditionSearch').waitFor({timeout:120000});
 await page.locator('#auditionSearch').fill('Stuck in the Middle');
 assert.ok(await page.locator('[data-audition]').count()>0,'Permanent TV roles reach the audition list');
 await page.locator('[data-tab="world"]').click();await page.locator('#worldSearch').fill('Stuck in the Middle');
 assert.ok((await page.locator('#screen').innerText()).includes('Season 1'));
 assert.ok(!requests.some(u=>u.includes('/1990.json.gz')),'Only nearby overlay years load');
 await page.locator('#settingsButton').click();assert.ok((await page.locator('.modal').innerText()).includes('Version 1.4.1'));
 assert.deepEqual(errors,[]);console.log('v1.4.1 browser passed: permanent Disney cast, auditions, World, saved-game reload and bounded year loading.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
