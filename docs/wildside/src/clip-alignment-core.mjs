/** Bounded ground-patch correspondence, using OpenCV's maintained kernels.
 * A fit proposes image corners; it does not establish a stationary plane,
 * physical scale, camera motion, or the identity of any landmark.
 * Forward/backward admission follows CHRONOS camera_motion.py at 6d248448.
 */
const MIN_TRACKS = 32, MIN_TRAIN = 24, MIN_HOLDOUT = 6;
const BACK_ERROR = .8, REPROJECTION_ERROR = 1.2;
const finitePoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const median = values => { const a = [...values].sort((a,b) => a-b); return a.length % 2 ? a[(a.length-1)/2] : (a[a.length/2-1]+a[a.length/2])/2; };
const distance = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const area = q => q.reduce((sum,p,i) => {const n=q[(i+1)%q.length]; return sum+p[0]*n[1]-p[1]*n[0];},0)/2;
function project(h,p) { const d=h[6]*p[0]+h[7]*p[1]+h[8]; return Math.abs(d)<1e-8 ? [NaN,NaN] : [(h[0]*p[0]+h[1]*p[1]+h[2])/d,(h[3]*p[0]+h[4]*p[1]+h[5])/d]; }
function convex(q) { const turns=q.map((a,i)=>{const b=q[(i+1)%4],c=q[(i+2)%4];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});return turns.every(t=>t>1e-6)||turns.every(t=>t< -1e-6); }
function checkFrame(frame) {
  const {width,height,data}=frame??{};
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<48||height<48||width>640||height>640||!(data instanceof Uint8Array||data instanceof Uint8ClampedArray)||data.length!==width*height*4)
    throw new TypeError('Ground tracking needs a bounded RGBA frame, 48–640 pixels per side.');
}
function grayscale(cv,frame) {
  checkFrame(frame);const rgba=cv.matFromArray(frame.height,frame.width,cv.CV_8UC4,frame.data),gray=new cv.Mat();
  try {cv.cvtColor(rgba,gray,cv.COLOR_RGBA2GRAY);return gray;} catch(error) {gray.delete();throw error;} finally {rgba.delete();}
}
function coverage(points) {
  if(!points.length)return false;
  const u=points.map(p=>p[0]),v=points.map(p=>p[1]);
  const cells=new Set(points.map(([x,y])=>Math.min(2,Math.max(0,Math.floor(x*3)))+3*Math.min(2,Math.max(0,Math.floor(y*3)))));
  const corners=[[0,0],[1,0],[1,1],[0,1]].every(([x,y])=>points.some(([u,v])=>(x?u>.65:u<.35)&&(y?v>.65:v<.35)));
  return {ok:Math.max(...u)-Math.min(...u)>=.65&&Math.max(...v)-Math.min(...v)>=.65&&cells.size>=6&&corners,cells:cells.size};
}

export class GroundPatchTracker {
  constructor(cv,frame,normalizedCorners) {
    checkFrame(frame);
    if(!Array.isArray(normalizedCorners)||normalizedCorners.length!==4||!normalizedCorners.every(p=>finitePoint(p)&&p.every(v=>v>=0&&v<=1))||!convex(normalizedCorners))
      throw new TypeError('Mark four visible, noncrossing ground corners.');
    this.cv=cv;this.width=frame.width;this.height=frame.height;this.steps=0;this.failed=false;this.previous=null;
    this.originalCorners=normalizedCorners.map(([x,y])=>[x*this.width-.5,y*this.height-.5]);
    this.currentCorners=this.originalCorners.map(p=>[...p]);this.originalArea=area(this.originalCorners);
    if(Math.abs(this.originalArea)<this.width*this.height*.025)throw Error('Use a larger visible ground patch to carry this reference.');
    const owned=[],keep=m=>(owned.push(m),m);
    try {
      this.previous=grayscale(cv,frame);
      const mask=keep(cv.Mat.zeros(this.height,this.width,cv.CV_8UC1));
      const polygon=keep(cv.matFromArray(4,1,cv.CV_32SC2,this.originalCorners.flat().map(Math.round)));
      cv.fillConvexPoly(mask,polygon,new cv.Scalar(255),cv.LINE_8,0);
      for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++)if(x<8||y<8||x>=this.width-8||y>=this.height-8)mask.data[y*this.width+x]=0;
      const detector=keep(new cv.GFTTDetector(400,.015,9,7,false,.04)),keys=keep(new cv.KeyPointVector());
      detector.detect(this.previous,keys,mask);
      const q=keep(cv.matFromArray(4,1,cv.CV_32FC2,this.originalCorners.flat())),uv=keep(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,1,0,1,1,0,1]));
      const mapping=keep(cv.getPerspectiveTransform(q,uv)),h=Array.from(mapping.data64F);
      this.tracks=Array.from({length:keys.size()},(_,id)=>{const p=keys.get(id).pt,xy=[p.x,p.y];return {id,original:xy,current:xy,uv:project(h,xy),holdout:id%4===0};});
      this.initialFeatures=this.tracks.length;this.initialHeldOutFeatures=this.tracks.filter(t=>t.holdout).length;
      if(this.tracks.length<MIN_TRACKS||!coverage(this.tracks.map(t=>t.uv)).ok)throw Error('This ground patch has too few well-spread details. Mark the new frame manually.');
    } catch(error) {this.dispose();throw error;} finally {for(const item of owned.reverse())item.delete();}
  }

  advance(frame) {
    if(this.failed||!this.previous)throw Error('Ground tracking has ended; start from the reviewed frame again.');
    checkFrame(frame);
    if(frame.width!==this.width||frame.height!==this.height)throw Error('Clip frame dimensions changed during tracking.');
    if(this.steps>=40)throw Error('Ground tracking frame budget reached.');
    const cv=this.cv,owned=[],keep=m=>(owned.push(m),m);let next=grayscale(cv,frame),retained=false;
    const refuse=(reason,details={})=>{this.failed=true;return {ok:false,reason,...details};};
    try {
      const p0=keep(cv.matFromArray(this.tracks.length,1,cv.CV_32FC2,this.tracks.flatMap(t=>t.current))),p1=keep(new cv.Mat()),back=keep(new cv.Mat());
      const forwardStatus=keep(new cv.Mat()),backStatus=keep(new cv.Mat()),forwardError=keep(new cv.Mat()),backError=keep(new cv.Mat());
      const window=new cv.Size(21,21),criteria=new cv.TermCriteria(cv.TermCriteria_COUNT+cv.TermCriteria_EPS,30,.01);
      cv.calcOpticalFlowPyrLK(this.previous,next,p0,p1,forwardStatus,forwardError,window,3,criteria);
      cv.calcOpticalFlowPyrLK(next,this.previous,p1,back,backStatus,backError,window,3,criteria);
      const tracks=[];
      for(let i=0;i<this.tracks.length;i++) {
        const current=[p1.data32F[2*i],p1.data32F[2*i+1]],returned=[back.data32F[2*i],back.data32F[2*i+1]];
        if(forwardStatus.data[i]&&backStatus.data[i]&&finitePoint(current)&&finitePoint(returned)&&distance(returned,this.tracks[i].current)<=BACK_ERROR&&current[0]>=2&&current[1]>=2&&current[0]<this.width-2&&current[1]<this.height-2)
          tracks.push({...this.tracks[i],current});
      }
      const train=tracks.filter(t=>!t.holdout),holdout=tracks.filter(t=>t.holdout);
      if(tracks.length<MIN_TRACKS||train.length<MIN_TRAIN||holdout.length<MIN_HOLDOUT)return refuse('too-few-consistent-tracks',{tracks:tracks.length});
      const a=keep(cv.matFromArray(train.length,1,cv.CV_32FC2,train.flatMap(t=>t.original))),b=keep(cv.matFromArray(train.length,1,cv.CV_32FC2,train.flatMap(t=>t.current))),mask=keep(new cv.Mat());
      cv.setRNGSeed(20261025);
      const fitted=keep(cv.findHomography(a,b,cv.RANSAC,REPROJECTION_ERROR,mask,2000,.995));
      if(fitted.empty())return refuse('no-supported-projective-fit');
      const h=Array.from(fitted.data64F);
      if(h.length!==9||!h.every(Number.isFinite))return refuse('invalid-projective-fit');
      const inliers=train.filter((_,i)=>mask.data[i]);
      if(inliers.length<MIN_TRAIN||inliers.length/train.length<.75)return refuse('conflicting-patch-motion',{inlierFraction:inliers.length/train.length});
      const errors=holdout.map(t=>distance(project(h,t.original),t.current));
      const checked=holdout.filter((_,i)=>errors[i]<=REPROJECTION_ERROR);
      if(!errors.every(Number.isFinite)||checked.length<MIN_HOLDOUT||checked.length/holdout.length<.75||median(errors)>REPROJECTION_ERROR)
        return refuse('held-out-tracks-disagree',{heldOutMedianPx:median(errors),heldOutPassed:checked.length,heldOutTotal:holdout.length});
      if(inliers.length+checked.length<this.initialFeatures*.6)return refuse('too-many-original-details-lost');
      const support=coverage([...inliers,...checked].map(t=>t.uv));
      if(!support.ok)return refuse('patch-support-too-concentrated',{gridCells:support.cells});
      const corners=this.originalCorners.map(p=>project(h,p)),denominators=this.originalCorners.map(p=>h[6]*p[0]+h[7]*p[1]+h[8]);
      if(!corners.every(p=>finitePoint(p)&&p[0]>=-.5&&p[1]>=-.5&&p[0]<=this.width-.5&&p[1]<=this.height-.5)||!convex(corners)||!denominators.every(d=>d>1e-8))return refuse('ground-corners-leave-view');
      const scale=area(corners)/this.originalArea;
      if(scale<.5||scale>2||corners.some((p,i)=>distance(p,this.currentCorners[i])>.12*Math.min(this.width,this.height)))return refuse('ground-patch-motion-too-large');
      this.previous.delete();this.previous=next;retained=true;this.tracks=[...inliers,...checked].sort((a,b)=>a.id-b.id);this.currentCorners=corners;this.steps++;
      this.diagnostics={steps:this.steps,initialFeatures:this.initialFeatures,trackedFeatures:this.tracks.length,fitInliers:inliers.length,fitCandidates:train.length,initialHeldOutFeatures:this.initialHeldOutFeatures,heldOutLost:this.initialHeldOutFeatures-checked.length,heldOutPassed:checked.length,heldOutTotal:holdout.length,heldOutMedianPx:median(errors),heldOutMaxPx:Math.max(...errors),gridCells:support.cells};
      return {ok:true,corners:corners.map(([x,y])=>[(x+.5)/this.width,(y+.5)/this.height]),diagnostics:{...this.diagnostics}};
    } finally {if(!retained)next.delete();for(const item of owned.reverse())item.delete();}
  }

  dispose() {if(this.previous){this.previous.delete();this.previous=null;}this.tracks=[];this.failed=true;}
}
