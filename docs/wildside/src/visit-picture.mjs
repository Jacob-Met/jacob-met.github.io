/** Export the just-rendered active scene canvas. No media upload or saved-world mutation. */
const PNG_SIGNATURE=[137,80,78,71,13,10,26,10];
export async function downloadRenderedPNG(canvas,{
  filename='wildside-visit.png',documentRef=globalThis.document,urlAPI=globalThis.URL,
  defer=globalThis.setTimeout,valid=()=>true,maxPixels=16_000_000,
}={}){
  if(!canvas||!Number.isSafeInteger(canvas.width)||!Number.isSafeInteger(canvas.height)||
     canvas.width<1||canvas.height<1||canvas.width>maxPixels/canvas.height||
     typeof canvas.toBlob!=='function')throw new Error('This view cannot be captured at its current resolution.');
  if(typeof valid!=='function'||!valid())throw new Error('The selected view changed before capture.');
  const blob=await new Promise((resolve,reject)=>{
    try{canvas.toBlob(value=>value?resolve(value):reject(new Error('The browser could not capture this view.')),'image/png');}
    catch(error){reject(error);}
  });
  if(!valid())throw new Error('The selected view changed before capture finished.');
  if(blob.type!=='image/png'||blob.size<=PNG_SIGNATURE.length)throw new Error('The browser did not produce a PNG picture.');
  const prefix=new Uint8Array(await blob.slice(0,PNG_SIGNATURE.length).arrayBuffer());
  if(!PNG_SIGNATURE.every((v,i)=>prefix[i]===v))throw new Error('The browser returned invalid PNG data.');
  if(!valid())throw new Error('The selected view changed before download.');
  const safeFilename=/^[a-z0-9][a-z0-9_-]{0,90}\.png$/i.test(filename)?filename:'wildside-visit.png';
  let href;
  try{
    href=urlAPI.createObjectURL(blob);
    const link=documentRef.createElement('a');link.href=href;link.download=safeFilename;link.hidden=true;
    documentRef.body.append(link);
    try{link.click();}finally{link.remove();}
    defer(()=>urlAPI.revokeObjectURL(href),2000);
    return {bytes:blob.size,width:canvas.width,height:canvas.height,filename:safeFilename};
  }catch(error){if(href)urlAPI.revokeObjectURL(href);throw error;}
}
