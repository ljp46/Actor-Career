const {chromium}=require('playwright'),assert=require('node:assert/strict'),{gzipSync}=require('node:zlib');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/data/filmographies/index.json*',r=>r.fulfill({json:{years:[],shows:{}}}));
 await page.route('**/data/years/index.json*',r=>r.fulfill({json:{years:[2020,2021,2022,2023],compression:'gzip'}}));
 await page.route('**/data/years/*.json.gz',r=>r.fulfill({body:gzipSync(JSON.stringify({year:Number(r.request().url().match(/(\d{4})\.json/)[1]),projects:[]}))}));
 await page.route('**/data/tv-seasons/index.json.gz*',r=>r.fulfill({body:gzipSync(JSON.stringify({shows:{},years:[]}))}));
 await page.route('**/data/casting-history/years/*.json.gz',r=>r.fulfill({body:gzipSync(JSON.stringify({projects:{}}))}));
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
 const get=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('second-take-save-v1')));
 await page.goto('http://127.0.0.1:8765');await page.locator('#name').fill('Vice Test');await page.locator('#birthday').fill('1996-03-10');await page.locator('#startAdult').click();await page.locator('#startDate').fill('2021-03-01');await page.locator('#new button[type=submit]').click();await page.locator('#ageButton').waitFor();
 await page.evaluate(async()=>{const e=await import('./engine.js?v=17'),r=await import('./relationships.js?v=17'),o=await import('./overhaul.js?v=17'),s=JSON.parse(localStorage.getItem(e.SAVE_KEY));const q=e.person(s,'Riley Stone','Actor',1997,'','female');o.socialProfile(s,q);q.socialLife={status:'dating',partnerName:'Jordan Vale',lastChange:'2020-01-01'};const b=r.bond(s,q);b.friendship=55;b.chemistry=60;s.lifeEvents=[];s.money=40000;localStorage.setItem(e.SAVE_KEY,JSON.stringify(s))});
 await page.reload();await page.locator('#ageButton').waitFor();
 // Pursuing someone taken
 await page.locator('[data-tab="people"]').click();await page.locator('[data-profile]').filter({hasText:'Riley'}).click();
 assert.match(await page.locator('#screen').innerText(),/Riley Stone is with Jordan Vale/);assert.equal(await page.locator('[data-social="flirt"]').isDisabled(),false);
 await page.locator('[data-vice="steal"]').click();await page.locator('.result-modal').waitFor();await page.locator('.result-modal [data-ok]').click();
 const riley=(await get()).people.find(p=>p.name==='Riley Stone');assert.ok(riley.socialLife.partnerId==='self'||(await get()).relationships['Riley Stone'].spaceUntil,'steal resolves either way');
 // Crime to prison
 let arrested=false;for(let i=0;i<60&&!arrested;i++){await page.evaluate(async()=>{const e=await import('./engine.js?v=17'),s=JSON.parse(localStorage.getItem(e.SAVE_KEY));s.energy=100;localStorage.setItem(e.SAVE_KEY,JSON.stringify(s))});await page.reload();await page.locator('[data-tab="activities"]').click();await page.locator('[data-crime="burglary"]').click();await page.locator('.result-modal').waitFor();arrested=(await page.locator('.result-modal h2').innerText())==='Busted';await page.locator('.result-modal [data-ok]').click()}
 assert.ok(arrested);await page.locator('.life-event-modal').waitFor();await page.locator('[data-life-answer="guilty"]').click();await page.locator('.result-modal [data-ok]').click();
 assert.ok((await get()).prison);await page.locator('[data-tab="activities"]').click();assert.match(await page.locator('#screen').innerText(),/Serving time for burglary/);assert.match(await page.locator('#topbar').innerText(),/Inmate/);
 await page.locator('[data-prison="behave"]').click();await page.locator('.result-modal [data-ok]').click();
 await page.locator('#settingsButton').click();await page.locator('#openCheats').click();await page.locator('[data-life-cheat="free"]').click();await page.locator('[data-close]').click();assert.equal((await get()).prison,null);
 assert.deepEqual(errors,[]);console.log('v1.8 browser passed: affairs with taken people, break-up attempts, crime, arrest, court, prison and the release cheat.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
