const {chromium}=require('playwright'),assert=require('node:assert/strict'),{gzipSync}=require('node:zlib');
const project=(id,extra={})=>({id,title:id,year:2020,kind:'Film',director:'Director',genre:'Drama',releaseDate:'2020-12-01',filmingStartDate:'2020-06-01',filmingEndDate:'2020-08-01',castingStartDate:'2020-01-01',voteCount:5000,popularity:30,baselineRating:8,roles:[{character:'Alex Reed',actor:'Original Actor',birthYear:1996,gender:'male',ageMin:18,ageMax:30,characterAge:24},{character:'Sam Cole',actor:'Co Star',birthYear:1995,gender:'female',ageMin:18,ageMax:30,characterAge:25}],...extra});
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const projects=Array.from({length:6},(_,i)=>project('Film '+i));
 await page.route('**/data/filmographies/index.json*',r=>r.fulfill({json:{years:[],shows:{}}}));
 await page.route('**/data/years/index.json*',r=>r.fulfill({json:{years:[2019,2020,2021,2022],compression:'gzip'}}));
 await page.route('**/data/years/*.json.gz',r=>r.fulfill({body:gzipSync(JSON.stringify({year:Number(r.request().url().match(/(\d{4})\.json/)[1]),projects:r.request().url().includes('2020.json')?projects:[]}))}));
 await page.route('**/data/tv-seasons/index.json.gz*',r=>r.fulfill({body:gzipSync(JSON.stringify({shows:{},years:[]}))}));
 await page.route('**/data/casting-history/years/*.json.gz',r=>r.fulfill({body:gzipSync(JSON.stringify({projects:{}}))}));
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
 const get=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('second-take-save-v1')));
 const put=fn=>page.evaluate(async src=>{const e=await import('./engine.js?v=17'),L=await import('./life.js?v=17'),S=await import('./spinoffs.js?v=17'),s=JSON.parse(localStorage.getItem(e.SAVE_KEY));await (new Function('s','e','L','S',src))(s,e,L,S);localStorage.setItem(e.SAVE_KEY,JSON.stringify(s))},fn);
 const idle=()=>page.waitForFunction(()=>!document.querySelector('#ageButton')?.disabled,{timeout:60000});
 const settle=async()=>{for(let i=0;i<40;i++){await idle();if(await page.locator('.result-modal').count()){await page.locator('.result-modal [data-ok]').click();continue}const m=page.locator('.life-event-modal');if(await m.count()){await m.locator('[data-life-answer]').last().click();continue}break}};

 // New life: the BitLife-style screen
 await page.goto('http://127.0.0.1:8765');await page.locator('#name').fill('Life Test');await page.locator('#birthday').fill('1996-01-01');await page.locator('#startAdult').click();await page.locator('#startDate').fill('2020-01-01');await page.locator('#new button[type=submit]').click();await page.locator('#ageButton').waitFor();
 assert.equal(await page.locator('.dock .statbar').count(),6,'five stats plus energy');assert.match(await page.locator('#topbar').innerText(),/Life Test/);assert.equal((await get()).lifeVersion,1);
 // One tap = one month
 const start=(await get()).date;await page.locator('#ageButton').click();await settle();const after=(await get()).date;assert.ok(Date.parse(after)-Date.parse(start)>=27*86400000||(await get()).advanceRemaining===0,'a month passes');
 // Activities give a result popup
 await page.locator('[data-tab="activities"]').click();await page.locator('[data-activity="meditate"]').click();await page.locator('.result-modal').waitFor();await page.locator('.result-modal [data-ok]').click();assert.ok((await get()).timeline.some(t=>t.title==='Meditation'));
 // Money, a home and a pet
 await put("s.money=500000;s.lifeEvents=[];");await page.reload();await page.locator('#ageButton').waitFor();await page.locator('[data-tab="assets"]').click();await page.locator('[data-buy-asset="studio"]').click();await page.locator('.result-modal [data-ok]').click();assert.ok((await get()).possessions.some(p=>p.id==='studio'));
 await page.locator('[data-shop="pet"]').click();await page.locator('[data-adopt="dog"]').click();await page.locator('.result-modal [data-ok]').click();assert.equal((await get()).pets.length,1);
 // An offer pops up and is accepted from the popup
 await page.locator('[data-tab="career"]').click();await page.locator('[data-seg="auditions"]').click();await page.locator('#featured [data-force-role]').first().click();
 assert.ok((await get()).roleOffers.some(o=>o.status==='offered'));
 await page.locator('[data-tab="assets"]').click();await page.locator('#ageButton').click();const offerSheet=page.locator('.life-event-modal');await offerSheet.waitFor();assert.ok(await offerSheet.locator('[data-life-answer="accept"]').count(),'offer popup has an accept button');await offerSheet.locator('[data-life-answer="accept"]').click();await page.locator('.result-modal').waitFor();await page.locator('.result-modal [data-ok]').click();await settle();assert.ok((await get()).filmography.some(f=>f.personId==='self'));
 // v1.6: a spin-off offer
 await put("s.lifeEvents=[];s.tvCareers.push({id:'tv-x',personId:'self',seriesId:'show-x',title:'Show X',character:'Max Hart',characterKey:'max hart',status:'ended',fans:90,lastProjectId:'none',lastSeason:2,handled:[]});S.launchSpinoff(s,[],s.tvCareers.at(-1));");
 await page.reload();await page.locator('#ageButton').waitFor();await page.locator('[data-advance="1"]').click();const spin=page.locator('.life-event-modal');await spin.waitFor();assert.match(await spin.innerText(),/spin-off/i);await spin.locator('[data-life-answer="later"]').click();await page.locator('.result-modal [data-ok]').click();await settle();
 await page.locator('[data-tab="career"]').click();await page.locator('[data-seg="offers"]').click();assert.match(await page.locator('#careerBody').innerText(),/Max Hart/);
 // v1.7: death, obituary, ribbon and inheritance by a child
 await put("s.lifeEvents=[];s.roleOffers.forEach(o=>o.status='declined');s.money=1000000;const kid=L.addChild(s,{adopted:true});kid.birthYear=1990;kid.birthDate='1990-03-03';L.handleDeath(s,[],'a stroke');");
 await page.reload();const end=page.locator('.life-event-modal');await end.waitFor();assert.match(await end.innerText(),/has died/);const heir=end.locator('[data-life-answer^="heir:"]');assert.equal(await heir.count(),1);await heir.click();await page.locator('.result-modal [data-ok]').click();
 const s=await get();assert.notEqual(s.activeId,'self');assert.equal(s.complete,false);assert.equal(s.money,800000);assert.equal(s.legacies.length,1);assert.ok(s.possessions.some(p=>p.ownerId===s.activeId));
 await page.locator('#settingsButton').click();await page.locator('#openLegacy').click();assert.match(await page.locator('#screen').innerText(),/Past lives/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 assert.deepEqual(errors,[]);console.log('v1.7 browser passed: life screen, monthly ageing, activity results, homes and pets, offer popups, spin-off offers, death, heir and legacy.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
