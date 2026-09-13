const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const PDFDocument=require('pdfkit');
const qrService=require('../src/services/qrService');
const pdfService=require('../src/services/pdfService');
const calibrationService=require('../src/services/calibrationService');
const app=require('../src/config/app');
const output=path.resolve(__dirname,'../tmp-check/calibration-parity');
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.00002,`${a} != ${b}`);
async function main(){
 fs.mkdirSync(output,{recursive:true});
 const assets=await calibrationService.getPreviewAssets();
 const qrBuffer=Buffer.from(assets.qrDataUrl.split(',')[1],'base64');
 assert.deepEqual(qrBuffer,await qrService.generateQrBuffer('https://emr.pe/c/TEST-QR-001'));
 assert.deepEqual(Buffer.from(assets.templateDataUrl.split(',')[1],'base64'),fs.readFileSync(app.printDefaults.templateFrontPath));
 const memory=new Map();global.localStorage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
 const store=await import(pathToFileURL(path.resolve(__dirname,'../../frontend/src/services/calibrationStore.js')));
 const inputPath=path.join(output,'browser-config.json');
 const config=fs.existsSync(inputPath)?JSON.parse(fs.readFileSync(inputPath,'utf8')):{
  qrPlacement:{x:20,y:75,width:25,height:25},
  qrPlacementNormalized:{x:0.31,y:0.56,width:0.35,height:0.35*880/1786},
 };
 store.saveCalibrationConfig(config.qrPlacement,config.qrPlacementNormalized);
 const saved=store.getProductionPrintConfig();assert.deepEqual(saved,config);
 const originalImage=PDFDocument.prototype.image;
 let pairs=[],current=[];
 const originalDraw=pdfService.drawHandtagPage;
 pdfService.drawHandtagPage=async function(doc,args){current=[];await originalDraw.call(this,doc,args);if(args.side==='front')pairs.push(current);};
 PDFDocument.prototype.image=function(buffer,x,y,options){current.push({buffer,x,y,width:options.width,height:options.height});return originalImage.call(this,buffer,x,y,options);};
 const rows=Array.from({length:6},()=>['TEST-QR-001',assets.qrUrl]);
 try{
  await pdfService.createPdfBundle(output,rows,{prefix:'PARITY'},'production',saved);
  assert.equal(pairs.length,6);
  const verify=pair=>{
   const [template,qr]=pair,n=saved.qrPlacementNormalized;
   assert.deepEqual(qr.buffer,qrBuffer);
   close((qr.x-template.x)/template.width,n.x);close((qr.y-template.y)/template.height,n.y);
   close(qr.width/template.width,n.width);close(qr.height/template.height,n.height);close(qr.width,qr.height);
  };
  pairs.forEach(verify);
  const production=pairs[0];pairs=[];
  await pdfService.createPreviewPdf(output,rows.slice(0,1),{...saved,previewMode:true},'PARITY_preview.pdf');
  assert.equal(pairs.length,1);verify(pairs[0]);
  const preview=pairs[0];
  close((production[1].x-production[0].x)/production[0].width,(preview[1].x-preview[0].x)/preview[0].width);
  assert.throws(()=>pdfService.resolveQrRectWithinDrawRect({x:0,y:0,width:65,height:140},{x:0.9,y:0,width:0.5,height:0.5}),/Invalid QR placement/);
  fs.writeFileSync(path.join(output,'parity-result.json'),JSON.stringify({realQrBytesIdentical:true,activeTemplateBytesIdentical:true,savedConfiguration:saved,productionPieces:6,previewPassed:true,productionRect:production.map(({buffer,...rect})=>rect),previewRect:preview.map(({buffer,...rect})=>rect)},null,2));
 }finally{PDFDocument.prototype.image=originalImage;pdfService.drawHandtagPage=originalDraw;}
 console.log('PASS: real PNG QR bytes identical in calibrator and PDFs; saved browser coordinates preserved in production and preview.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
