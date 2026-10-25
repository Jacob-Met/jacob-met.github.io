/** Source-pixel appearance extraction. Explicit region/outline; no semantic segmentation or 3D inference. */
const forms=new Set(['unspecified','shrub','broadleaf','flowers','canopy']);
const fail=message=>{throw new Error(message);};
const bounded=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
const rounded=value=>Math.round(value*1e6)/1e6;
const rgbToHex=rgb=>'#'+rgb.map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join('');
function regionValid(region){if(!Array.isArray(region)||region.length!==4||!region.every(Number.isFinite)||region[0]<0||region[1]<0||region[2]<=0||region[3]<=0||region[0]+region[2]>1+1e-9||region[1]+region[3]>1+1e-9)fail('Select a nonempty image region inside the photo');return [...region];}
function polygonValid(polygon){
 if(polygon===null||polygon===undefined)return null;
 if(!Array.isArray(polygon)||polygon.length<3||polygon.length>64||polygon.some(p=>!Array.isArray(p)||p.length!==2||!p.every(v=>bounded(v,0,1))))fail('Outline requires 3–64 normalized image points');
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let i=0;i<polygon.length;i++)for(let j=i+1;j<polygon.length;j++){
  if(j===i+1||i===0&&j===polygon.length-1)continue;
  const a=polygon[i],b=polygon[(i+1)%polygon.length],c=polygon[j],d=polygon[(j+1)%polygon.length];
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)fail('Outline must not cross itself');
 }
 if(Math.abs(polygon.reduce((s,p,i)=>{const q=polygon[(i+1)%polygon.length];return s+p[0]*q[1]-q[0]*p[1];},0))<1e-8)fail('Outline has no area');
 return polygon.map(p=>[...p]);
}
function inside(point,polygon){if(!polygon)return true;let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
function outlineStats(polygon,width,height){
 if(!polygon)return null;
 const points=polygon.map(([x,y])=>[x*width,y*height]),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 let area2=0,cx=0,cy=0,perimeter=0;
 for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length],v=p[0]*q[1]-q[0]*p[1];area2+=v;cx+=(p[0]+q[0])*v;cy+=(p[1]+q[1])*v;perimeter+=Math.hypot(q[0]-p[0],q[1]-p[1]);}
 const area=Math.abs(area2)/2,boxWidth=Math.max(...xs)-Math.min(...xs),boxHeight=Math.max(...ys)-Math.min(...ys);
 return {method:'human-outline-2d',areaFraction:rounded(area/(width*height)),boundsAspect:rounded(boxWidth/boxHeight),fillRatio:rounded(area/(boxWidth*boxHeight)),compactness:rounded(4*Math.PI*area/(perimeter*perimeter)),centroid:[rounded(cx/(3*area2)/width),rounded(cy/(3*area2)/height)]};
}
function palette(samples,count){
 // Quantized weighted RGB bins, then deterministic farthest-seeded weighted k-means.
 const bins=new Map();for(const rgb of samples){const key=(rgb[0]>>4)*256+(rgb[1]>>4)*16+(rgb[2]>>4);let bin=bins.get(key);if(!bin){bin={key,n:0,sum:[0,0,0]};bins.set(key,bin);}bin.n++;rgb.forEach((v,i)=>bin.sum[i]+=v);}
 const points=[...bins.values()].map(b=>({...b,color:b.sum.map(x=>x/b.n)})).sort((a,b)=>b.n-a.n||a.key-b.key);
 const distance=(a,b)=>.2126*(a[0]-b[0])**2+.7152*(a[1]-b[1])**2+.0722*(a[2]-b[2])**2;
 const centers=[points[0].color];
 while(centers.length<Math.min(count,points.length)){let best=null,score=-1;for(const p of points){const s=Math.min(...centers.map(c=>distance(c,p.color)))*Math.sqrt(p.n);if(s>score){score=s;best=p.color;}}if(score<1e-9)break;centers.push([...best]);}
 let groups;
 for(let iteration=0;iteration<12;iteration++){
  groups=centers.map(()=>({n:0,sum:[0,0,0]}));for(const p of points){let nearest=0;for(let i=1;i<centers.length;i++)if(distance(p.color,centers[i])<distance(p.color,centers[nearest]))nearest=i;const g=groups[nearest];g.n+=p.n;p.sum.forEach((v,i)=>g.sum[i]+=v);}
  let moved=0;groups.forEach((g,i)=>{if(!g.n)return;const next=g.sum.map(v=>v/g.n);moved+=distance(next,centers[i]);centers[i]=next;});if(moved<.001)break;
 }
 return groups.map((g,i)=>({color:rgbToHex(centers[i]),weight:g.n/samples.length})).filter(g=>g.weight>0).sort((a,b)=>b.weight-a.weight||a.color.localeCompare(b.color));
}
/** rgba uses decoded, orientation-corrected image pixels. Region and optional outline use that orientation. */
export function extractAppearance({rgba,width,height,region,outline=null,form='unspecified',maxSamples=4096,paletteSize=4}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width*height>50_000_000||!(rgba instanceof Uint8Array||rgba instanceof Uint8ClampedArray)||rgba.length!==width*height*4)fail('Provide bounded decoded RGBA pixels');
 region=regionValid(region);outline=polygonValid(outline);if(!forms.has(form))fail('Unsupported human-annotated plant form');
 if(!Number.isInteger(maxSamples)||maxSamples<64||maxSamples>16384||!Number.isInteger(paletteSize)||paletteSize<1||paletteSize>6)fail('Appearance sampling budget is invalid');
 if(outline&&outline.some(([x,y])=>x<region[0]||x>region[0]+region[2]||y<region[1]||y>region[1]+region[3]))fail('Keep the outline inside the selected region');
 const left=Math.max(0,Math.floor(region[0]*width)),top=Math.max(0,Math.floor(region[1]*height)),right=Math.min(width,Math.ceil((region[0]+region[2])*width)),bottom=Math.min(height,Math.ceil((region[1]+region[3])*height));
 const rw=right-left,rh=bottom-top,cols=Math.max(1,Math.min(rw,Math.floor(Math.sqrt(maxSamples*rw/rh)))),rows=Math.max(1,Math.min(rh,Math.floor(maxSamples/cols)));
 const samples=[],luminances=[];let edgeSum=0,edgePairs=0;
 const lum=(r,g,b)=>(.2126*r+.7152*g+.0722*b)/255;
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const px=left+Math.min(rw-1,Math.floor((x+.5)*rw/cols)),py=top+Math.min(rh-1,Math.floor((y+.5)*rh/rows));
  if(!inside([(px+.5)/width,(py+.5)/height],outline))continue;
  const i=(py*width+px)*4;if(rgba[i+3]<128)continue;
  const rgb=[rgba[i],rgba[i+1],rgba[i+2]];if(rgb.some(v=>!bounded(v,0,255)))fail('RGBA data contains invalid values');samples.push(rgb);const l=lum(...rgb);luminances.push(l);
  if(px+1<right){const j=i+4;if(rgba[j+3]>=128&&inside([(px+1.5)/width,(py+.5)/height],outline)){edgeSum+=Math.abs(l-lum(rgba[j],rgba[j+1],rgba[j+2]));edgePairs++;}}
 }
 if(samples.length<8)fail('Select a larger visible foreground region');
 luminances.sort((a,b)=>a-b);const q=t=>luminances[Math.min(luminances.length-1,Math.floor(t*(luminances.length-1)))];
 return {version:1,region,outline,pixels:{method:'explicit-region-rgb-clusters',imageSize:[width,height],sampleCount:samples.length,palette:palette(samples,paletteSize),luma:{p10:rounded(q(.1)),median:rounded(q(.5)),p90:rounded(q(.9))},horizontalContrast:rounded(edgePairs?edgeSum/edgePairs:0)},silhouette:outlineStats(outline,width,height),interpretation:{form}};
}

/** Admit only bounded derived values; no image bytes, URLs, filenames or arbitrary extra properties. */
export function validateAppearance(input){
 if(!input||input.version!==1)fail('Unsupported appearance version');
 const region=regionValid(input.region),outline=polygonValid(input.outline),pixels=input.pixels,form=input.interpretation?.form;
 if(!forms.has(form)||pixels?.method!=='explicit-region-rgb-clusters'||!Number.isInteger(pixels.sampleCount)||pixels.sampleCount<8||pixels.sampleCount>16384||!Array.isArray(pixels.palette)||!pixels.palette.length||pixels.palette.length>6)fail('Invalid source appearance');
 if(!Array.isArray(pixels.imageSize)||pixels.imageSize.length!==2||!pixels.imageSize.every(v=>Number.isInteger(v)&&v>0)||pixels.imageSize[0]*pixels.imageSize[1]>50_000_000)fail('Invalid appearance image dimensions');
 if(outline&&outline.some(([x,y])=>x<region[0]||x>region[0]+region[2]||y<region[1]||y>region[1]+region[3]))fail('Keep the outline inside the selected region');
 const colors=pixels.palette.map(p=>{if(!/^#[0-9a-f]{6}$/.test(p.color)||!bounded(p.weight,0,1)||p.weight===0)fail('Invalid appearance palette');return {color:p.color,weight:p.weight};});
 if(Math.abs(colors.reduce((s,c)=>s+c.weight,0)-1)>1e-6)fail('Palette weights must sum to one');
 const l=pixels.luma;if(!l||![l.p10,l.median,l.p90].every(v=>bounded(v,0,1))||l.p10>l.median||l.median>l.p90||!bounded(pixels.horizontalContrast,0,1))fail('Invalid pixel statistics');
 let silhouette=null;
 if(input.silhouette!==null&&input.silhouette!==undefined){const s=input.silhouette;if(!outline||s.method!=='human-outline-2d'||!bounded(s.areaFraction,0,1)||!bounded(s.boundsAspect,1e-9,1e9)||!bounded(s.fillRatio,0,1)||!bounded(s.compactness,0,1.000001)||!Array.isArray(s.centroid)||s.centroid.length!==2||!s.centroid.every(v=>bounded(v,0,1)))fail('Invalid 2D outline statistics');silhouette=outlineStats(outline,...pixels.imageSize);}
 return {version:1,region,outline,pixels:{method:pixels.method,imageSize:[...pixels.imageSize],sampleCount:pixels.sampleCount,palette:colors,luma:{p10:l.p10,median:l.median,p90:l.p90},horizontalContrast:pixels.horizontalContrast},silhouette,interpretation:{form}};
}

/** Browser adapter reads only the selected crop at original pixel resolution, then releases the canvas. */
export function extractImageAppearance(image,{region,outline=null,form='unspecified',maxSamples=4096,paletteSize=4}){
 region=regionValid(region);outline=polygonValid(outline);
 const width=image?.naturalWidth,height=image?.naturalHeight,document=image?.ownerDocument??globalThis.document;
 if(!document||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width*height>50_000_000)fail('Wait for a bounded photo to decode');
 const left=Math.floor(region[0]*width),top=Math.floor(region[1]*height),right=Math.min(width,Math.ceil((region[0]+region[2])*width)),bottom=Math.min(height,Math.ceil((region[1]+region[3])*height)),cw=right-left,ch=bottom-top;
 if(cw*ch>16_000_000)fail('Choose a smaller source region (up to 16 megapixels)');
 const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
 try{const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,left,top,cw,ch,0,0,cw,ch);const rgba=ctx.getImageData(0,0,cw,ch).data;
  const result=extractAppearance({rgba,width:cw,height:ch,region:[0,0,1,1],outline:outline?.map(([x,y])=>[(x*width-left)/cw,(y*height-top)/ch]),form,maxSamples,paletteSize});
  result.region=region;result.outline=outline;result.pixels.imageSize=[width,height];return validateAppearance(result);
 }finally{canvas.width=0;canvas.height=0;}
}
