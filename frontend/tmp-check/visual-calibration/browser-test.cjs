const fs=require('fs');const path=require('path');const assert=require('assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let tabs;for(let i=0;i<40;i++){try{tabs=await(await fetch('http://127.0.0.1:9224/json')).json();if(tabs.length)break;}catch{}await sleep(200);}
 const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100);}throw Error('Timeout: '+expression);};
 await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5173'});
 await wait('document.querySelectorAll(".section-tab").length===2');
 await evaluate('document.querySelectorAll(".section-tab")[1].click()');
 await wait('!!document.querySelector(".calibration-rnd") && document.querySelector(".handtag-template-image").naturalWidth>0');
 await sleep(300);

 const baseline=process.argv.includes('--baseline');const results={};
 const rects=()=>evaluate(`(()=>{const image=document.querySelector('.handtag-template-image'),q=document.querySelector('.calibration-rnd'),o=document.querySelector('.handtag-overlay');const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};const h=document.querySelector('.guide-horizontal'),v=document.querySelector('.guide-vertical');return {image:rect(image),qr:rect(q),overlay:rect(o),h:h?rect(h):null,v:v?rect(v):null,color:h?getComputedStyle(h).backgroundColor:null,outline:getComputedStyle(q).outlineWidth}})()`);
 const setInput=async(label,value)=>{
  await evaluate(`[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith('${label}')).querySelector('input').focus()`);await sleep(80);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
  await send('Input.insertText',{text:String(value)});await sleep(100);
 };
 const blur=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});};
 const field=label=>evaluate(`[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith('${label}')).querySelector('input').value`);
 const near=(a,b)=>assert.ok(Math.abs(a-b)<0.06,`${a} != ${b}`);
 const square=(r,size)=>{near(r.qr.width,r.qr.height);if(size)near(r.qr.width,size);};
 const guides=r=>{near(r.h.y,r.qr.y+r.qr.height/2);near(r.v.x,r.qr.x+r.qr.width/2);near(r.h.x,r.image.x);near(r.v.y,r.image.y);near(r.h.width,r.image.width);near(r.v.height,r.image.height);near(r.h.height,1);near(r.v.width,1);};
 const toggle=()=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Mostrar')||b.textContent.startsWith('Ocultar')).click()`);
 const screenshot=async(name)=>{const b=await evaluate(`(()=>{const r=document.querySelector('.handtag-stage').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()`);const img=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(__dirname,name),Buffer.from(img.data,'base64'));};
 results.initial=await rects();
 await setInput('Width',320);results.immediateHeight=await field('Height');await blur();await sleep(100);results.square320=await rects();square(results.square320,320);
 if(!baseline)assert.equal(results.immediateHeight,'320');
 const imageForAlignment=(await rects()).image;
 await setInput('X',imageForAlignment.width/2-160);await blur();
 await setInput('Y',imageForAlignment.height*(1184.5/1786)-160);await blur();await sleep(100);
 if(!(await rects()).h)await toggle();await sleep(100);results.guides320=await rects();guides(results.guides320);await screenshot(baseline?'before.png':'viewport-square320.png');
 // Check the image-local origin explicitly with a temporary DOM-only offset.
 await evaluate(`(()=>{const i=document.querySelector('.handtag-template-image');i.style.marginLeft='7px';i.style.marginTop='9px';i.style.width='calc(100% - 7px)';})()`);await sleep(300);results.offsetImage=await rects();
 if(!baseline){near(results.offsetImage.overlay.x,results.offsetImage.image.x);near(results.offsetImage.overlay.y,results.offsetImage.image.y);guides(results.offsetImage);}
 await evaluate(`document.querySelector('.handtag-template-image').removeAttribute('style')`);await sleep(300);
 await setInput('Width',320);await blur();await sleep(100);
 let r=await rects();let x=r.qr.x+r.qr.width-2,y=r.qr.y+r.qr.height-2;
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
 results.resizeSamples=[];for(let step=1;step<=4;step++){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+step*5,y:y+step*4,button:'left',buttons:1});await sleep(60);r=await rects();square(r);guides(r);results.resizeSamples.push(r.qr);}
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+20,y:y+16,button:'left',clickCount:1});await sleep(100);
 assert.ok(Math.abs((await rects()).qr.width-320)>1,'Corner resize must change size');
 await setInput('Width',280);results.width280Height=await field('Height');await blur();await sleep(100);results.square280=await rects();square(results.square280,280);if(!baseline)assert.equal(results.width280Height,'280');
 await setInput('Height',300);await blur();await sleep(100);square(await rects(),300);assert.equal(await field('Width'),'300');
 r=await rects();x=r.qr.x+100;y=r.qr.y+100;await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+15,y:y+10,button:'left',buttons:1});await sleep(100);results.dragged=await rects();guides(results.dragged);await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+15,y:y+10,button:'left',clickCount:1});await sleep(100);
 r=await rects();await toggle();await sleep(100);results.hidden=await rects();assert.equal(results.hidden.h,null);assert.equal(results.hidden.v,null);assert.deepEqual(results.hidden.qr,r.qr);
 await toggle();await sleep(100);results.shown=await rects();assert.deepEqual(results.shown.qr,r.qr);guides(results.shown);if(!baseline)assert.equal(results.shown.color,'rgb(255, 0, 0)');
 await screenshot(baseline?'before-final.png':'viewport-after-drag.png');
 fs.writeFileSync(path.join(__dirname,baseline?'baseline.json':'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({baseline,immediateHeight:results.immediateHeight,dom320:results.square320.qr,offsetError:{x:results.offsetImage.overlay.x-results.offsetImage.image.x,y:results.offsetImage.overlay.y-results.offsetImage.image.y},cornerResize:'square at every sample',width280Height:results.width280Height,dragAndToggle:'passed'},null,2));
 await send('Browser.close');ws.close();
})().catch(e=>{console.error(e);process.exit(1)});

