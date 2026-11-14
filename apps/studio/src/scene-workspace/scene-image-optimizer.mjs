// One adaptive import path for backgrounds, physical objects, artwork and layers.
// The editor never changes the original source image's aspect or alpha matte.
export const SCENE_IMAGE_MODES = Object.freeze({
  balanced: { label:'Dengeli · otomatik', offset:0 },
  detail: { label:'Detay koruma', offset:3 },
  compact: { label:'Daha küçük dosya', offset:-4 },
});

const clamp = (value,min,max)=>Math.min(max,Math.max(min,value));
const MAX_IN_BYTES=30*1024*1024, MAX_OUT_BYTES=8*1024*1024;

export function sceneImageProfile(path='', overrides={}){
  const isBackdrop=/^\/scene-assets\/approved\//.test(path);
  const isBookCover=/^\/scene-assets\/books\/scene-closed\/(?:evren|topluluk)-master-closed(?:-en)?\.webp$/.test(path);
  const highDetail=isBookCover||/^\/scene-assets\/(?:books|robe|p8|stone|metal-pendulum|dagger|vefk|camera)\//.test(path);
  const maxEdge=isBackdrop?2048:(highDetail?2048:1536);
  const quality=Number.isFinite(Number(overrides.quality))&&Number(overrides.quality)>0
    ?clamp(Number(overrides.quality),84,98)
    :clamp((highDetail?96:isBackdrop?94:92)+(SCENE_IMAGE_MODES[overrides.mode]?.offset??0),84,98);
  const requestedMax=Number(overrides.maxEdge);
  return Object.freeze({
    kind:isBookCover?'book-cover':isBackdrop?'background':highDetail?'detail':'artwork',
    quality, maxEdge:requestedMax>0?clamp(requestedMax,512,4096):maxEdge,
    fixedSize:isBookCover?{width:1536,height:1024}:null,
    maxPixels:12e6, maxBytes:MAX_OUT_BYTES, minSavings:highDetail?.12:.10,
  });
}

export function sceneImageDimensions(width,height,profile){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)
    throw new Error('Görsel ölçüleri geçersiz.');
  if(profile.fixedSize){
    if(Math.abs(width/height-1.5)>.018)
      throw new Error('Kapalı kitap resmi 3:2 olmalı; saydam silueti korunmalı.');
    return profile.fixedSize;
  }
  if(profile.kind==='background'&&
      (width!==height*2||width<1024))
    throw new Error('Oda arka planı tam 2:1 oranında ve en az 1024 piksel genişliğinde olmalı.');
  const factor=Math.min(1,4096/width,4096/height,profile.maxEdge/Math.max(width,height),
    Math.sqrt(profile.maxPixels/(width*height)));
  const resized={width:Math.max(1,Math.round(width*factor)),height:Math.max(1,Math.round(height*factor))};
  if(profile.kind==='background'&&resized.width!==2*resized.height){
    resized.height=Math.max(512,Math.round(resized.width/2));
    resized.width=2*resized.height;
  }
  return resized;
}

export function shouldKeepOriginalWebp(originalBytes,compressedBytes,changedDimensions,profile){
  return !changedDimensions&&compressedBytes>originalBytes*(1-profile.minSavings);
}

export function summarizeSceneImage(report){
  if(!report)return '';
  const kilo=value=>Math.max(1,Math.round(value/1024))+' KB';
  const dims=report.outputWidth+'×'+report.outputHeight;
  return report.originalBytes===report.outputBytes&&report.reusedOriginal
    ? 'Görsel zaten uygun · '+kilo(report.outputBytes)+' · '+dims+' · dosya korundu'
    : 'Görsel uyarlaması: '+kilo(report.originalBytes)+' → '+kilo(report.outputBytes)
        +' · '+(report.originalBytes>report.outputBytes?
          '%'+Math.round(100*(1-report.outputBytes/report.originalBytes))+' tasarruf':'yüksek ayrıntı korunuyor')
        +' · '+dims+' · WebP Q'+report.quality;
}

const fileToDataUrl=file=>new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error('Görsel okunamadı.'));
  reader.onload=()=>resolve(reader.result);
  reader.readAsDataURL(file);
});

export async function adaptSceneImage(file,path='',settings={}){
  if(!file||file.size>MAX_IN_BYTES||
    (!/^image\/(png|jpeg|webp)$/.test(file.type)&&!/\.(png|jpe?g|webp)$/i.test(file.name)))
    throw new Error('En fazla 30 MB PNG, JPEG veya WebP yüklenebilir.');
  const bitmap=await createImageBitmap(file);
  try {
    const profile=sceneImageProfile(path,settings);
    const output=sceneImageDimensions(bitmap.width,bitmap.height,profile);
    const originalWebp=file.type==='image/webp'||/\.webp$/i.test(file.name);
    const changedDimensions=output.width!==bitmap.width||output.height!==bitmap.height;
    // Avoid recompressing a good source on every re-upload: it preserves the
    // shape, fine detail and exact transparency of small existing WebP art.
    if(originalWebp&&!changedDimensions&&file.size<=96*1024){
      return {dataUrl:await fileToDataUrl(file),report:{
        originalBytes:file.size,outputBytes:file.size,sourceWidth:bitmap.width,
        sourceHeight:bitmap.height,outputWidth:output.width,outputHeight:output.height,
        quality:profile.quality,reusedOriginal:true,
      }};
    }
    const canvas=document.createElement('canvas');
    canvas.width=output.width;canvas.height=output.height;
    const context=canvas.getContext('2d',{alpha:true});
    if(!context)throw new Error('Tarayıcıda görsel dönüştürücü başlatılamadı.');
    context.clearRect(0,0,output.width,output.height);
    context.drawImage(bitmap,0,0,output.width,output.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',profile.quality/100));
    canvas.width=canvas.height=0;
    if(!blob||blob.type!=='image/webp'||blob.size>MAX_OUT_BYTES)
      throw new Error('Görsel 8 MB WebP çıktı sınırına sığmadı.');
    const reusedOriginal=originalWebp&&shouldKeepOriginalWebp(
      file.size,blob.size,changedDimensions,profile);
    const chosen=reusedOriginal?file:blob;
    return {dataUrl:await fileToDataUrl(chosen),report:{
      originalBytes:file.size,outputBytes:chosen.size,
      sourceWidth:bitmap.width,sourceHeight:bitmap.height,
      outputWidth:reusedOriginal?bitmap.width:output.width,
      outputHeight:reusedOriginal?bitmap.height:output.height,
      quality:profile.quality,reusedOriginal,
    }};
  }finally{bitmap.close();}
}
