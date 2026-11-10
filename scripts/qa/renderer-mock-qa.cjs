// Optional standalone QA harness: provide PUPPETEER_MODULE if Puppeteer is installed outside this repository.
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer');
const fs = require('fs');
const path = require('path');
const OUT=process.env.WIREBOUND_QA_OUTPUT_DIR || path.join(require('os').tmpdir(),'wirebound-qa','renderer-mock');
const BASE_URL=process.env.WIREBOUND_QA_BASE_URL || 'http://127.0.0.1:8765/';
fs.mkdirSync(OUT,{recursive:true});
const report=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const settings={
 dns:'8.8.8.8',port:'31416',autoStart:false,launchAtLogin:false,telemetryEnabled:false,
 customDns:'1.1.1.1',theme:'dark',language:'id',onboardingCompleted:true
};
const device={id:'FAKE1234SIMULATED',name:'Synthetic Android 15 Mock Device',
 status:'device',battery:'75',tunnelStatus:'idle',traffic:{interfaceName:'tun0',rxBytes:1024000,txBytes:128000}};
const checks=[
 {id:'adbRuntime',status:'pass',detail:'ADB runtime present'},
 {id:'gnirehtetRuntime',status:'pass',detail:'Gnirehtet present'},
 {id:'adbQuery',status:'pass',detail:'ADB responsive'},
 {id:'deviceAccess',status:'pass',detail:'One authorized synthetic device'},
 {id:'androidVersion',status:'pass',detail:'Android 15'},
 {id:'gnirehtetClient',status:'info',detail:'VPN not running'}
];
async function init(page, initialSettings) {
 await page.evaluateOnNewDocument((s,d,c)=>{
   const mock={settings:{...s},scans:0,lastCopied:null, logListeners:[], statusListeners:[],deviceListeners:[]};
   window.__qa=mock;
   window.api={
    getSettings:async()=>({...mock.settings}),
    saveSettings:async(newSettings)=>(mock.settings={...newSettings}),
    getStatus:async()=> 'disconnected',
    getDeviceSnapshot:async()=>({devices:[d]}),
    onDevicesChange:fn=>{mock.deviceListeners.push(fn);return ()=>{}},
    onLog:fn=>{mock.logListeners.push(fn);return ()=>{}},
    onStatusChange:fn=>{mock.statusListeners.push(fn);return ()=>{}},
    getAppVersion:async()=> '1.2.0',
    getDiagnostics:async()=>{
      mock.scans++;
      await new Promise(r=>setTimeout(r,450));
      if(mock.failNextScan){mock.failNextScan=false;throw Error('Synthetic diagnostic error')}
      const checkResults=mock.failNextCheckResult
        ? c.map(check=>check.id==='adbRuntime'
          ? {...check,status:'error',detail:'Synthetic ADB runtime failure'} : check)
        : c;
      mock.failNextCheckResult=false;
      return {generatedAt:new Date().toISOString(),engineStatus:'disconnected',
        appVersion:'1.2.0',checks:checkResults,devices:[{id:'FA...ED',name:d.name,status:'device',
        androidVersion:'15',apiLevel:'35',gnirehtetInstalled:true,gnirehtetActive:false}]}
    },
    copySupportReport:async(text)=>{mock.lastCopied=text;if(mock.failNextCopy){mock.failNextCopy=false;return {success:false,error:'Synthetic denied clipboard'}}return {success:true}},
    exportSupportReport:async()=>({success:true,cancelled:true}),
    checkForUpdates:async()=>({success:true,currentVersion:'1.2.0',updateAvailable:false}),
    getCrashTelemetryState:async()=>({available:false,uploadEnabled:false}),
    openExternal:async()=>({success:true}),
    testSpeedOnDevice:async()=>({success:true}),
    startDeviceTunnel:async(id)=>{(mock.deviceStartCalls ||= []).push(id);if(mock.failNextDeviceAction){mock.failNextDeviceAction=false;return {success:false,error:'Synthetic device action failure'}}return {success:true}},
    stopDeviceTunnel:async(id)=>{(mock.deviceStopCalls ||= []).push(id);return {success:true}},
    startGnirehtet:async(dns,port)=>{mock.engineStart={dns,port};mock.statusListeners.forEach(fn=>fn('connected'));return {success:true}},
    stopGnirehtet:async()=>{mock.engineStopped=true;mock.statusListeners.forEach(fn=>fn('disconnected'));return {success:true}},
    windowControl:()=>{}
   };
   window.__qaPushLog=(n=1)=>{
     for(let i=0;i<n;i++)mock.logListeners.forEach(fn=>fn({timestamp:'10:00',type:'info',message:'Synthetic log entry '+i}));
   };
 },initialSettings,device,checks);
 await page.goto(BASE_URL,{waitUntil:'networkidle0',timeout:25000});
 await page.waitForSelector('button',{timeout:10000});
}
async function test(name,fn) {try{let detail=await Promise.race([fn(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Step timed out after 10 seconds')),10000))]); report.push({name,pass:true,detail});console.log('PASS',name,JSON.stringify(detail));}catch(e){report.push({name,pass:false,error:String(e)});console.error('FAIL',name,String(e));}}
async function main(){
 const browser=await puppeteer.launch({
  headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {}),
  args:['--no-sandbox','--disable-gpu','--force-device-scale-factor=1','--disable-dev-shm-usage']
 });
 try {
  const page=await browser.newPage();
  page.on('pageerror',e=>console.error('PAGEERROR',String(e)));
  await page.setViewport({width:1008,height:650,deviceScaleFactor:1});
  await init(page,settings);
  await test('Dashboard initiates a real scan after returning user opens app',async()=>{
   await page.waitForFunction(()=>window.__qa.scans>0);
   return page.evaluate(()=>({scans:window.__qa.scans,detailsHidden:document.querySelector('#wirebound-diagnostic-details').hidden}));
  });
  await test('Diagnostic auto-collapses after finished scan',async()=>{
   await delay(3500);
   const hidden=await page.$eval('#wirebound-diagnostic-details',el=>el.hidden);
   if(!hidden)throw Error('Diagnostic panel remained open');
   await page.screenshot({path:path.join(OUT,'dashboard-collapsed-mock-1008.png')});
   await page.setViewport({width:800,height:600,deviceScaleFactor:1});
   await page.screenshot({path:path.join(OUT,'dashboard-collapsed-mock-800.png')});
   await page.setViewport({width:1008,height:650,deviceScaleFactor:1});
   return {hidden};
  });
  await test('Manual diagnostic expansion survives idle',async()=>{
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Lihat diagnostik'))?.click());
   await delay(3000);
   const hidden=await page.$eval('#wirebound-diagnostic-details',el=>el.hidden);
   if(hidden)throw Error('Manual expansion closed unexpectedly');
   return {hidden};
  });
  await test('Rerun triggers real scan and temporary reveal',async()=>{
   const before=await page.evaluate(()=>window.__qa.scans);
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Jalankan Lagi'))?.click());
   await delay(800);
   const after=await page.evaluate(()=>window.__qa.scans);
   if(after!==before+1)throw Error('No new scan');
   return {before,after,visible:!(await page.$eval('#wirebound-diagnostic-details',e=>e.hidden))};
  });
  await test('Copy masked diagnostic report',async()=>{
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Salin Laporan'))?.click());
   await delay(120);
   const copied=await page.evaluate(()=>window.__qa.lastCopied);
   if(!copied?.includes('FA...ED')||copied.includes('FAKE1234SIMULATED'))throw Error('Masking broken');
   return {masked:true};
  });
  await test('No horizontal overflow at 600, 800, 1008 and 1280 widths',async()=>{
   const res=[];
   for(const width of [600,800,1008,1280]){
    await page.setViewport({width,height:650,deviceScaleFactor:1});
    await delay(120);
    const dims=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,scrollers:[...document.querySelectorAll('*')].filter(el=>el.scrollWidth>el.clientWidth+6 && getComputedStyle(el).overflowX !=='visible').slice(0,8).map(el=>({tag:el.tagName,classes:el.className,scroll:el.scrollWidth,client:el.clientWidth}))}));
    const engineWidth=await page.evaluate(()=>[...document.querySelectorAll('h2')].find(e=>e.textContent.trim()==='Wirebound Engine')?.parentElement?.querySelector('p')?.getBoundingClientRect().width);
    if(width===600&&engineWidth<160)throw Error('Engine description squeezed to '+engineWidth+'px');
    if(dims.document>width+2||dims.body>width+2)throw Error('Page horizontally overflows '+JSON.stringify(dims));
    res.push({width,document:dims.document,body:dims.body});
   }
   await page.setViewport({width:800,height:650,deviceScaleFactor:1});
   await page.screenshot({path:path.join(OUT,'dashboard-expanded-mock-800.png')});
   return res;
  });
  await test('Responsive multi-device and unauthorized device states',async()=>{
   await page.setViewport({width:600,height:650,deviceScaleFactor:1});
   await page.evaluate(()=>{
      const synthetic=[
       {id:'SYNTHETICFIRST',name:'Synthetic Android Device One',status:'device',battery:'75',tunnelStatus:'connected',traffic:{interfaceName:'tun0',rxBytes:800,txBytes:400}},
       {id:'SYNTHETICSECOND',name:'Synthetic Android Device Two with an intentionally very long display name',status:'unauthorized',tunnelStatus:'unavailable'}
      ];
      window.__qa.deviceListeners.forEach(fn=>fn({devices:synthetic}));
   });
   await delay(150);
   const state=await page.evaluate(()=>({
    cards:document.querySelectorAll('article').length,
    hasUnauthorized:document.body.innerText.includes('Belum izin'),
    document:document.documentElement.scrollWidth,
    width:innerWidth,
    clipped:[...document.querySelectorAll('article button')].map(x=>({label:x.textContent.trim(),left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right})).filter(x=>x.right>innerWidth+3||x.left<0)
   }));
   await page.screenshot({path:path.join(OUT,'multi-device-mock-600.png')});
   if(state.cards!==2||!state.hasUnauthorized||state.document>state.width+2||state.clipped.length)throw Error(JSON.stringify(state));
   return state;
  });
  await test('Empty device state stays legible and restores',async()=>{
    await page.evaluate(()=>window.__qa.deviceListeners.forEach(fn=>fn({devices:[]})));
    await delay(120);
    const empty=await page.evaluate(()=>({cards:document.querySelectorAll('article').length,text:document.body.innerText.includes('Tidak ada perangkat terdeteksi')}));
    await page.evaluate(()=>window.__qa.deviceListeners.forEach(fn=>fn({devices:[{id:'FAKE1234SIMULATED',name:'Synthetic Android 15 Mock Device',status:'device',battery:'75',tunnelStatus:'idle'}]})));
    await page.setViewport({width:1008,height:650,deviceScaleFactor:1});
    if(empty.cards!==0||!empty.text)throw Error(JSON.stringify(empty));
    return empty;
  });
  await test('Engine and per-device actions expose failure and retry recovery',async()=>{
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Mulai Koneksi'))?.click());
    await delay(200);
    const engine=await page.evaluate(()=>window.__qa.engineStart);
    if(engine?.dns!=='8.8.8.8'||engine?.port!=='31416')throw Error('Engine start not forwarded '+JSON.stringify(engine));

    await page.evaluate(()=>{
      window.__qa.failNextDeviceAction=true;
      [...document.querySelectorAll('article button')].find(b=>b.textContent.includes('Coba Lagi'))?.click();
    });
    await delay(180);
    const failed=await page.evaluate(()=>({
      text:document.querySelector('article [role="alert"]')?.textContent.trim(),
      callCount:window.__qa.deviceStartCalls?.length
    }));
    if(!failed.text?.includes('Gagal mengubah koneksi')||failed.callCount!==1)throw Error('Device action error invisible '+JSON.stringify(failed));

    await page.evaluate(()=>[...document.querySelectorAll('article button')].find(b=>b.textContent.includes('Coba Lagi'))?.click());
    await delay(180);
    const retried=await page.evaluate(()=>({
      alert:!!document.querySelector('article [role="alert"]'),
      startCalls:window.__qa.deviceStartCalls?.length
    }));
    if(retried.alert||retried.startCalls!==2)throw Error('Retry did not clear action error '+JSON.stringify(retried));

    await page.evaluate(()=>window.__qa.deviceListeners.forEach(fn=>fn({devices:[{
      id:'FAKE1234SIMULATED',name:'Synthetic Android 15 Mock Device',status:'device',
      battery:'75',tunnelStatus:'connected',traffic:{interfaceName:'tun0',rxBytes:1024000,txBytes:128000}
    }]})));
    await delay(120);
    await page.evaluate(()=>[...document.querySelectorAll('article button')].find(b=>b.textContent.includes('Putuskan'))?.click());
    await delay(140);
    const disconnected=await page.evaluate(()=>window.__qa.deviceStopCalls||[]);
    if(disconnected.length!==1||disconnected[0]!=='FAKE1234SIMULATED')throw Error('Disconnect not forwarded');

    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Hentikan Koneksi'))?.click());
    await delay(120);
    const stopped=await page.evaluate(()=>window.__qa.engineStopped);
    if(!stopped)throw Error('Engine stop not forwarded');
    return {engine,visibleError:true,retryClearedError:true,perDeviceStop:true,engineStopped:stopped};
  });
  await test('New terminal output does not move dashboard scroll',async()=>{
   await page.evaluate(()=>{const root=[...document.querySelectorAll('div')].find(el=>el.classList.contains('custom-scrollbar')&&el.classList.contains('overflow-y-auto')&&el.querySelector('#wirebound-diagnostic-details'));root.scrollTop=0;window.__qaPushLog(30)});
   await delay(300);
   const s=await page.evaluate(()=>{const root=[...document.querySelectorAll('div')].find(el=>el.classList.contains('custom-scrollbar')&&el.classList.contains('overflow-y-auto')&&el.querySelector('#wirebound-diagnostic-details'));return root.scrollTop});
   if(s!==0)throw Error('Dashboard jumped to '+s);
   return {scrollTop:s};
  });
  await test('Clear logs availability follows logs',async()=>{
   const state=await page.evaluate(()=>{const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().toLowerCase()==='bersihkan');return {disabled:btn?.disabled}});
   if(state.disabled)throw Error('Clear still disabled despite mock logs');
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().toLowerCase()==='bersihkan')?.click());
   await delay(140);
   const disabled=await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().toLowerCase()==='bersihkan')?.disabled);
   if(!disabled)throw Error('Clear enabled on empty logs');
   return {afterClearDisabled:disabled};
  });
  await test('Settings has precise last checked time',async()=>{
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Pengaturan')?.click());
   await delay(350);
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Periksa Pembaruan'))?.click());
   await delay(180);
   const text=await page.evaluate(()=>document.body.innerText);
   if(!text.includes('Terakhir diperiksa'))throw Error('Timestamp missing');
   return {timestampPresent:true};
  });
  const onboard=await browser.newPage();
  await onboard.setViewport({width:800,height:600,deviceScaleFactor:1});
  await init(onboard,{...settings,onboardingCompleted:false});
  await test('Onboarding live light/dark preview',async()=>{
   const get=()=>onboard.evaluate(()=>document.documentElement.getAttribute('data-theme'));
   const initial=await get();
   await onboard.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Light')?.click());
   await delay(100);
   const light=await get();
   await onboard.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Dark')?.click());
   await delay(100);
   const dark=await get();
   if(initial!=='dark'||light!=='light'||dark!=='dark')throw Error(JSON.stringify({initial,light,dark}));
   await onboard.screenshot({path:path.join(OUT,'onboarding-mock-800.png')});
   return {initial,light,dark};
  });
  await test('Completed scan with a failed ADB check stays expanded and announces issues',async()=>{
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Dasbor')?.click());
    await delay(180);
    await page.evaluate(()=>{
      window.__qa.failNextCheckResult=true;
      [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Jalankan Lagi'))?.click();
    });
    await delay(3300);
    const result=await page.evaluate(()=>({
      hidden:document.querySelector('#wirebound-diagnostic-details').hidden,
      message:document.body.innerText.includes('Beberapa pemeriksaan perlu ditangani'),
      failedCheck:document.body.innerText.includes('Synthetic ADB runtime failure'),
      completed:document.body.innerText.includes('4/6 siap')
    }));
    if(result.hidden||!result.message||!result.failedCheck||!result.completed)
      throw Error('Completed failed-check scan was hidden or mislabeled: '+JSON.stringify(result));
    return result;
  });
  await test('Diagnostic failure discards previous success and remains expanded',async()=>{
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Dasbor')?.click());
   await delay(250);
   await page.evaluate(()=>{window.__qa.failNextScan=true});
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Jalankan Lagi'))?.click());
   await delay(850);
   const state=await page.evaluate(()=>({
    error:document.body.innerText.includes('Synthetic diagnostic error'),
    count:document.body.innerText.includes('5/6 siap'),
    hidden:document.querySelector('#wirebound-diagnostic-details').hidden,
    label:document.body.innerText.includes('Pemeriksaan gagal diselesaikan')
   }));
   if(!state.error||state.count||state.hidden||!state.label)throw Error(JSON.stringify(state));
   return state;
  });
  await test('Subsequent successful retry recovers after diagnostic failure',async()=>{
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Jalankan Diagnostik'))?.click());
   await delay(850);
   const hasCount=await page.evaluate(()=>document.body.innerText.includes('5/6 siap'));
   if(!hasCount)throw Error('Successful data absent');
   await delay(2750);
   const hidden=await page.$eval('#wirebound-diagnostic-details',el=>el.hidden);
   if(!hidden)throw Error('Not collapsed after successful retry');
   return {hasCount,hidden};
  });
  await test('Clipboard IPC rejection shows actionable error',async()=>{
   await page.evaluate(()=>{window.__qa.failNextCopy=true;[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Salin Laporan'))?.click()});
   await delay(250);
   const failed=await page.evaluate(()=>document.body.innerText.includes('Gagal menyalin laporan'));
   if(!failed)throw Error('Copy rejection had no error feedback');
   return {failed};
  });
  await test('Dismiss ready state prevents banner until dashboard exits',async()=>{
   const dismiss=await page.$('button[aria-label="Tutup pemberitahuan"]');
   if(!dismiss)throw Error('No dismiss button');
   await page.evaluate(()=>document.querySelector('button[aria-label="Tutup pemberitahuan"]')?.click());
   await delay(100);
   if(await page.$('button[aria-label="Tutup pemberitahuan"]'))throw Error('Dismissed ready notice remained');
   return {dismissed:true};
  });
  await test('Settings timestamp persists across navigation',async()=>{
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Pengaturan')?.click());
   await delay(180);
   const result=await page.evaluate(()=>({
     persisted:!!localStorage.getItem('wirebound.update.lastSuccess'),
     visible:document.body.innerText.includes('Terakhir diperiksa')
   }));
   if(!result.persisted||!result.visible)throw Error(JSON.stringify(result));
   return result;
  });
  await onboard.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Light')?.click());
  await delay(150);
  await onboard.screenshot({path:path.join(OUT,'onboarding-light-mock-800.png')});
  await page.close();await onboard.close();
 }finally{await browser.close()}
 fs.writeFileSync(path.join(OUT,'mock-browser-result.json'),JSON.stringify(report,null,2));
 if(report.some(r=>!r.pass))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=2});