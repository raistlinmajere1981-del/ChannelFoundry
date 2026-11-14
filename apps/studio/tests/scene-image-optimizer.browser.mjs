import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
const origin='http://127.0.0.1:5298';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5298'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let logs='';
server.stdout.on('data',b=>logs+=b);
server.stderr.on('data',b=>logs+=b);
let browser;
try{
  let ready=false;
  for(let i=0;i<150;i++){
    try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,'Vite startup: '+logs);
  browser=await chromium.launch({
    executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],
  });
  const page=await browser.newPage({viewport:{width:1360,height:768}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
  const report=await page.evaluate(async()=>{
    const {adaptSceneImage}=await import('/src/scene-workspace/scene-image-optimizer.mjs');
    const source=document.createElement('canvas');
    source.width=1200;source.height=800;
    const ctx=source.getContext('2d');
    const image=ctx.createImageData(source.width,source.height);
    for(let y=0;y<800;y++)for(let x=0;x<1200;x++){
      const i=(y*1200+x)*4,noise=(x*143+y*37+x*y*17)%251;
      image.data[i]=noise;image.data[i+1]=Math.floor((x+y)/10)%256;
      image.data[i+2]=(y*5+x*13)%256;image.data[i+3]=x<120?0:255;
    }
    ctx.putImageData(image,0,0);
    const png=await new Promise(resolve=>source.toBlob(resolve,'image/png'));
    const file=new File([png],'kılıç.png',{type:'image/png'});
    const optimized=await adaptSceneImage(file,'/scene-assets/custom/sword.webp',{mode:'balanced'});
    const response=await fetch(optimized.dataUrl);
    const webp=await response.blob();
    const bitmap=await createImageBitmap(webp);
    const output=document.createElement('canvas');
    output.width=bitmap.width;output.height=bitmap.height;
    const outputCtx=output.getContext('2d');
    outputCtx.drawImage(bitmap,0,0);
    const alpha=outputCtx.getImageData(0,0,1200,800).data;
    const empty=alpha[(10*1200+10)*4+3];
    const full=alpha[(300*1200+500)*4+3];
    bitmap.close();
    const existing=new File([webp],'sword.webp',{type:'image/webp'});
    const second=await adaptSceneImage(existing,'/scene-assets/custom/sword.webp',{mode:'balanced'});
    return {input:png.size,output:webp.size,report:optimized.report,
      reused:second.report.reusedOriginal,empty,full,
      outputType:webp.type,dimensions:[output.width,output.height]};
  });
  assert.equal(report.outputType,'image/webp');
  assert.deepEqual(report.dimensions,[1200,800]);
  assert.equal(report.empty,0,'fully transparent background remains transparent');
  assert.equal(report.full,255,'opaque ornament remains opaque');
  assert.ok(report.output<report.input*.9,
    'a photo-like high-entropy PNG should be substantially compressed: '+JSON.stringify(report));
  assert.ok(report.report.quality>=90);
  assert.deepEqual(errors,[]);
  console.log('PASS browser artwork PNG→WebP conversion, alpha, format, dimensions, savings',report);
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
