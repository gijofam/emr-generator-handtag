const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const PDFDocument = require('pdfkit');
const pdfService = require('../src/services/pdfService');
const app = require('../src/config/app');
const {calculateLayout} = require('../src/utils/printLayout');
const {mmToPoints} = require('../src/utils/printConfig');
const output = process.env.PRINT_TEST_OUTPUT_DIR
 ? path.resolve(process.env.PRINT_TEST_OUTPUT_DIR)
 : path.resolve(__dirname, '../tmp-check/size-65x140');
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} != ${b}`);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const templatePaths = [app.printDefaults.templateFrontPath, app.printDefaults.templateBackPath];
const templateHashes = templatePaths.map(hash);
// No real database client is loaded: repositories are replaced only in this test process.
const repository = {createBatch:async (_id,n)=>({id:`case-${n}`}),updateBatchStatus:async()=>{},codeExists:async()=>false,createCodes:async()=>{}};
for(const [file,exports] of [
 ['../src/repositories/handtagRepository',repository],
 ['../src/repositories/productRepository',{findById:async()=>({id:'test',prefix:'CHECK',name:'Test'})}],
 ['../src/repositories/batchRepository',{}],
]) require.cache[require.resolve(file)]={id:require.resolve(file),filename:require.resolve(file),loaded:true,exports};
const batchService = require('../src/services/batchService');
const calibrationService = require('../src/services/calibrationService');
let pageIndex=-1, current, records=[];
const addPage=PDFDocument.prototype.addPage;
PDFDocument.prototype.addPage=function(options){pageIndex++;return addPage.call(this,options);};
const draw=pdfService.drawHandtagPage;
pdfService.drawHandtagPage=async function(doc,args){
 current={page:pageIndex,side:args.side,code:args.code,qrUrl:args.qrUrl,slot:{x:args.x,y:args.y,width:args.width,height:args.height},images:[]};
 records.push(current); return draw.call(this,doc,args);
};
const image=PDFDocument.prototype.image;
PDFDocument.prototype.image=function(buffer,x,y,options){
 const meta=this.openImage(buffer);
 close(options.width/meta.width,options.height/meta.height);
 assert.deepEqual(this._ctm.slice(0,4),[1,0,0,-1]);
 const record={x,y,width:options.width,height:options.height,naturalWidth:meta.width,naturalHeight:meta.height};
 current.images.push(record);
 assert.ok(x>=-1e-6 && y>=-1e-6);
 assert.ok(x+options.width<=current.slot.width+1e-6 && y+options.height<=current.slot.height+1e-6);
 return image.call(this,buffer,x,y,options);
};
function checkPages(pdfPath, expected){
 const text=fs.readFileSync(pdfPath).toString('latin1');
 assert.equal((text.match(/\/Type \/Page\b/g)||[]).length,expected);
}
function checkGeometry(n){
 for(let page=0;page<=pageIndex;page++){
  const entries=records.filter(r=>r.page===page);
  assert.equal(entries.length,Math.min(6,n-Math.floor(page/2)*6));
  for(let i=0;i<entries.length;i++){
   const {slot,images,side}=entries[i];
   close(slot.width,mmToPoints(69));close(slot.height,mmToPoints(144));
   close(slot.x,mmToPoints(0.5+(i%3)*70));close(slot.y,mmToPoints(4+Math.floor(i/3)*145));
   assert.ok(slot.x+slot.width<=mmToPoints(210));assert.ok(slot.y+slot.height<=mmToPoints(297));
   const template=images[0];
   close(template.x,0);close(template.y,0);
   assert.ok(template.width<=slot.width+1e-6);
   assert.ok(template.height<=slot.height+1e-6);
   assert.equal(images.length,side==='front'?2:1);
   if(side==='front'){
    const qr=images[1];close(qr.width,qr.height);
    // Independent frame measurements from the current front PNG.
    const frame={x:template.x+template.width*227/880,y:template.y+template.height*976/1786,
      width:template.width*426/880,height:template.height*417/1786};
    close(qr.x+qr.width/2,frame.x+frame.width/2);
    close(qr.y+qr.height/2,frame.y+frame.height/2);
    const padding=Math.min(frame.width,frame.height)*0.05;
    assert.ok(qr.x>=frame.x+padding-1e-6 && qr.y>=frame.y+padding-1e-6);
    assert.ok(qr.x+qr.width<=frame.x+frame.width-padding+1e-6);
    assert.ok(qr.y+qr.height<=frame.y+frame.height-padding+1e-6);
   }
   for(const other of entries.slice(i+1)){
    assert.ok(slot.x+slot.width<=other.slot.x || other.slot.x+other.slot.width<=slot.x || slot.y+slot.height<=other.slot.y || other.slot.y+other.slot.height<=slot.y);
   }
  }
  if(page%2===1){
   const fronts=records.filter(r=>r.page===page-1);
   assert.deepEqual(entries.map(r=>[r.code,r.slot]),fronts.map(r=>[r.code,r.slot]));
  }
 }
}
async function main(){
 fs.mkdirSync(output,{recursive:true});
 const config=pdfService.resolvePrintConfig();
 assert.deepEqual([config.handtagWidthMm,config.handtagHeightMm,config.bleedMm,config.spacingMm,config.marginMm],[65,140,2,1,0]);
 const layout=calculateLayout({paperSize:{width:210,height:297}});
 assert.deepEqual([layout.columns,layout.rows,layout.handtagsPerPage,layout.orientation],[3,2,6,'vertical']);
 assert.deepEqual([layout.gridWidthMm,layout.gridHeightMm,layout.startXMm,layout.startYMm],[209,289,0.5,4]);
 const horizontal={columns:Math.floor(211/145),rows:Math.floor(298/70)};
 assert.deepEqual(horizontal,{columns:1,rows:4});
 const rotated=calculateLayout({paperSize:{width:297,height:210}});
 assert.equal(rotated.orientation,'horizontal');assert.equal(rotated.handtagsPerPage,6);
 assert.throws(()=>calculateLayout({paperSize:{width:20,height:20}}),/No handtag fits/);
 assert.throws(()=>calculateLayout({paperSize:{width:210,height:297},bleed:-1}));
 const zeroBleed=calculateLayout({paperSize:{width:210,height:297},bleed:0,spacing:0});
 assert.equal(zeroBleed.effectiveWidthMm,65);
 const originalOutput=app.outputDir;app.outputDir=output;
 const results=[];
 for(const n of [1,6,7,12]){
  pageIndex=-1;records=[];let saved=[];
  repository.createCodes=async codes=>{saved=codes;};
  const batch=await batchService.generateBatch({productId:'test',quantity:n});
  const expectedPages=2*Math.ceil(n/6);
  const pdfPath=path.join(output,batch.batchId,`CHECK_${batch.batchId}.pdf`);
  checkPages(pdfPath,expectedPages);checkGeometry(n);
  assert.equal(saved.length,n);assert.equal(new Set(saved.map(r=>r.code)).size,n);
  for(const r of saved) assert.match(r.code,/^CHECK-(?:[A-Z][0-9]){3}$/);
  const csv=fs.readFileSync(pdfPath.replace(/\.pdf$/,'.csv'),'utf8').split('\n');
  assert.deepEqual(csv,['code,qrUrl',...saved.map(r=>`${r.code},${r.qrUrl}`)]);
  assert.deepEqual(records.filter(r=>r.side==='front').map(r=>[r.code,r.qrUrl]),saved.map(r=>[r.code,r.qrUrl]));
  results.push({count:n,pages:expectedPages,records:structuredClone(records),pdfPath});
 }
 // Exercise the duplicate-code retry without touching the database.
 const makeCode=batchService.makeCode;let attempts=0;
 batchService.makeCode=()=>++attempts===1?'CHECK-A1A1A1':'CHECK-B2B2B2';
 repository.codeExists=async code=>code==='CHECK-A1A1A1';
 assert.equal(await batchService.createUniqueCode('CHECK'),'CHECK-B2B2B2');
 batchService.makeCode=makeCode;
 pageIndex=-1;records=[];
 const log=console.log;console.log=()=>{};
 try{await calibrationService.generatePreviewPdf({previewOffsetMm:{x:4,y:5}});}finally{console.log=log;}
 const previewPath=path.join(output,'test','preview.pdf');checkPages(previewPath,2);
 const prod=results[0].records[0],preview=records[0];
 close(preview.slot.width,mmToPoints(65));close(preview.slot.height,mmToPoints(140));
 close(preview.slot.x,mmToPoints(4));close(preview.slot.y,mmToPoints(5));
 // Preview keeps the final-size canvas; production fits the full effective slot.
 const previewTemplate=preview.images[0], productionTemplate=prod.images[0];
 close(previewTemplate.width/previewTemplate.height,productionTemplate.width/productionTemplate.height);
 close(Math.max(previewTemplate.width/mmToPoints(65),previewTemplate.height/mmToPoints(140)),1);
 close(Math.max(productionTemplate.width/mmToPoints(69),productionTemplate.height/mmToPoints(144)),1);
 close(preview.images[1].width/previewTemplate.width,prod.images[1].width/productionTemplate.width);
 close(preview.images[1].height/previewTemplate.height,prod.images[1].height/productionTemplate.height);
 close((preview.images[1].x-previewTemplate.x)/previewTemplate.width,
   (prod.images[1].x-productionTemplate.x)/productionTemplate.width);
 close((preview.images[1].y-previewTemplate.y)/previewTemplate.height,
   (prod.images[1].y-productionTemplate.y)/productionTemplate.height);
 // Verify frontend calibration uses inverse, uniform conversions for the real PNG ratio.
 const panel=fs.readFileSync(path.resolve(__dirname,'../../frontend/src/components/CalibrationPanel.jsx'),'utf8');
 const source=panel.slice(panel.indexOf('function clamp('),panel.indexOf('function parseSize('));
 const ctx={HANDTAG_DIMENSIONS_MM:{width:65,height:140},DEFAULT_QR_PLACEMENT:{x:13,y:74,width:30,height:30}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const rect={width:399,height:985.5};const placement={x:13,y:74,width:30,height:30};
 const px=ctx.mmToPx(placement,rect);close(px.width,px.height);
 const roundtrip=ctx.pxToMm(px,rect);for(const key of Object.keys(placement))close(roundtrip[key],placement[key]);
 assert.deepEqual(templatePaths.map(hash),templateHashes);
 assert.ok(!require.cache[require.resolve('../src/config/prisma')]);
 app.outputDir=originalOutput;
 fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify({layout,horizontal:{...horizontal,capacity:4},results,preview:{pdfPath:previewPath,records},templateHashes,database:'mocked; no Prisma client loaded'},null,2));
 console.log(JSON.stringify({layout, horizontalCapacity:4,cases:results.map(({count,pages})=>({count,pages})),preview:'passed',csv:'passed',codes:'passed including collision retry',calibrationRoundtrip:'passed',templateHashesUnchanged:true},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
