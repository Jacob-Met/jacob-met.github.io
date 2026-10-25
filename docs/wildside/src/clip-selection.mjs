import {captureClipFrame} from './clip-frame.mjs';

// A bounded visual index for the existing annotation workflow. These image
// measurements do not establish scene identity, geometry or camera movement.
export const CLIP_SCAN_LIMITS = Object.freeze({samples:48, views:6, dimension:160, milliseconds:20000});
const GRID = 16;
const abortError = () => new DOMException('Clip scan cancelled.', 'AbortError');
const finite = x => typeof x === 'number' && Number.isFinite(x);

export function clipSampleTimes(duration, maxSamples = CLIP_SCAN_LIMITS.samples) {
  if (!finite(duration) || duration <= 0) throw new RangeError('A finite clip duration is required.');
  if (!Number.isInteger(maxSamples) || maxSamples < 2 || maxSamples > CLIP_SCAN_LIMITS.samples)
    throw new RangeError('Clip scan sample budget is invalid.');
  const count = Math.min(maxSamples, Math.max(2, Math.ceil(duration * 2) + 1));
  const last = duration - Math.min(.05, duration / 10);
  return Array.from({length:count}, (_,i) => last * i / (count - 1));
}

/** Coarse RGB averages retain color changes while suppressing small decoder
 * noise. Detail is measured on a smoothed raster; neither is a learned quality
 * score. Keep the fixed representative while comparing, so slow drift cannot
 * hide behind a series of almost-identical adjacent frames. */
export function measureClipFrame(rgba, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > CLIP_SCAN_LIMITS.dimension || height > CLIP_SCAN_LIMITS.dimension ||
      !(rgba instanceof Uint8Array || rgba instanceof Uint8ClampedArray) || rgba.length !== width * height * 4)
    throw new RangeError('Clip analysis requires a bounded complete RGBA preview.');
  const sums = new Float64Array(GRID * GRID * 3), counts = new Uint32Array(GRID * GRID);
  const gray = new Float32Array(width * height);
  let pixelSum=0,pixelSquare=0;
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const pixel=y*width+x, at=pixel*4, cell=Math.min(GRID-1,Math.floor(y*GRID/height))*GRID+Math.min(GRID-1,Math.floor(x*GRID/width));
    counts[cell]++;
    for(let c=0;c<3;c++) sums[cell*3+c]+=rgba[at+c];
    gray[pixel]=(77*rgba[at]+150*rgba[at+1]+29*rgba[at+2])/256;
    pixelSum+=gray[pixel]/255;pixelSquare+=(gray[pixel]/255)**2;
  }
  const descriptor=new Float32Array(GRID*GRID*3);
  let mean=0,square=0,cells=0;
  for(let cell=0;cell<counts.length;cell++) {
    if(!counts[cell]) continue;
    for(let c=0;c<3;c++) descriptor[cell*3+c]=sums[cell*3+c]/counts[cell]/255;
    const l=(77*descriptor[cell*3]+150*descriptor[cell*3+1]+29*descriptor[cell*3+2])/256;
    mean+=l;square+=l*l;cells++;
  }
  const variance=square/cells-(mean/cells)**2;
  const contrast=variance>1e-12?Math.sqrt(variance):0;
  const smoothed=new Float32Array(gray.length);
  for(let y=1;y<height-1;y++) for(let x=1;x<width-1;x++) {
    let sum=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) sum+=gray[(y+dy)*width+x+dx];
    smoothed[y*width+x]=sum/9;
  }
  let edges=0,n=0;
  for(let y=2;y<height-2;y++) for(let x=2;x<width-2;x++) {
    const at=y*width+x;
    edges+=Math.abs(smoothed[at+1]-smoothed[at-1])+Math.abs(smoothed[at+width]-smoothed[at-width]);n++;
  }
  const detail=n ? edges/n/510 : 0;
  const pixelVariance=pixelSquare/gray.length-(pixelSum/gray.length)**2;
  const coherence=pixelVariance>1e-12?Math.min(1,contrast/Math.sqrt(pixelVariance)):0;
  // Fine noise alone must not earn a high rank. Detail only adjusts the
  // spatially coherent contrast, rather than contributing an independent bonus.
  return {descriptor,contrast,detail,coherence,quality:contrast*coherence*(.8+Math.min(1,detail*4)*.2)};
}

export function clipViewDifference(a,b) {
  if(a?.descriptor?.length!==GRID*GRID*3||b?.descriptor?.length!==GRID*GRID*3)
    throw new TypeError('Compared clip views require complete descriptors.');
  let sum=0;
  for(let i=0;i<a.descriptor.length;i++) sum+=Math.abs(a.descriptor[i]-b.descriptor[i]);
  return sum/a.descriptor.length;
}

/** Select quality-weighted farthest views, then restore temporal order. The
 * returned indices refer to supplied decoded samples, never unseen frames. */
export function selectClipViews(frames, {maxViews=CLIP_SCAN_LIMITS.views, minDifference=.075}={}) {
  if(!Array.isArray(frames)||frames.length<1||frames.length>CLIP_SCAN_LIMITS.samples||
     !Number.isInteger(maxViews)||maxViews<1||maxViews>CLIP_SCAN_LIMITS.views||
     !finite(minDifference)||minDifference<=0||minDifference>1)
    throw new RangeError('Clip candidate bounds are invalid.');
  for(const f of frames) if(!finite(f.offsetSeconds)||f.offsetSeconds<0||!finite(f.quality)||f.quality<0||
      f.descriptor?.length!==GRID*GRID*3||!f.descriptor.every(x=>finite(x)&&x>=0&&x<=1))
    throw new TypeError('Clip candidate measurements are invalid.');
  const ranked=frames.map((f,i)=>i).sort((a,b)=>frames[b].quality-frames[a].quality||frames[a].offsetSeconds-frames[b].offsetSeconds);
  const best=frames[ranked[0]].quality;
  const eligible=ranked.filter(i=>best<.02||frames[i].quality>=best*.18);
  const chosen=[eligible[0]];
  while(chosen.length<Math.min(maxViews,eligible.length)) {
    let winner=null,score=-1;
    for(const i of eligible) {
      if(chosen.includes(i)) continue;
      const distance=Math.min(...chosen.map(j=>clipViewDifference(frames[i],frames[j])));
      if(distance<minDifference) continue;
      const weighted=distance*(best>.02?.5+.5*frames[i].quality/best:1);
      if(weighted>score){winner=i;score=weighted;}
    }
    if(winner===null) break;
    chosen.push(winner);
  }
  return chosen.sort((a,b)=>frames[a].offsetSeconds-frames[b].offsetSeconds);
}

export async function scanClipViews(video,{signal,onProgress=()=>{},maxSamples=CLIP_SCAN_LIMITS.samples,
  maxViews=CLIP_SCAN_LIMITS.views,timeoutMs=CLIP_SCAN_LIMITS.milliseconds}={}) {
  if(!finite(timeoutMs)||timeoutMs<1||timeoutMs>CLIP_SCAN_LIMITS.milliseconds)
    throw new RangeError('Clip scan elapsed-time budget is invalid.');
  if(signal?.aborted) throw abortError();
  const times=clipSampleTimes(video.duration,maxSamples),frames=[],deadline=performance.now()+timeoutMs;
  let incomplete=false,stopReason=null;
  try {
    for(const seconds of times) {
      if(signal?.aborted) throw abortError();
      const remaining=deadline-performance.now();
      if(remaining<=0){incomplete=true;stopReason='Time budget reached';break;}
      let frame;
      try {frame=await captureClipFrame(video,seconds,{signal,maxDimension:CLIP_SCAN_LIMITS.dimension,timeoutMs:remaining});}
      catch(error) {
        if(signal?.aborted||error.name==='AbortError'||!frames.length) throw error;
        incomplete=true;stopReason=error.message;break;
      }
      const {image,offsetSeconds}=frame;
      const pixels=image.getContext('2d',{willReadFrequently:true}).getImageData(0,0,image.width,image.height);
      frames.push({...measureClipFrame(pixels.data,image.width,image.height),image,offsetSeconds});
      onProgress(frames.length,times.length);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(signal?.aborted) throw abortError();
    if(!frames.length) throw new Error('No clip preview could be decoded within the scan budget.');
    const indices=selectClipViews(frames,{maxViews}),keep=new Set(indices);
    frames.forEach((f,i)=>{if(!keep.has(i)){f.image.width=0;f.image.height=0;}});
    return {candidates:indices.map(i=>frames[i]),sampled:frames.length,planned:times.length,incomplete,stopReason};
  } catch(error) {
    for(const f of frames){f.image.width=0;f.image.height=0;}
    throw error;
  }
}
