import {identifyMedia,captureTimestamp} from './review/draft.mjs';
import {loadClipMetadata,captureClipFrame} from './clip-frame.mjs';
import {scanClipViews} from './clip-selection.mjs';
import {groundReferences,carryGroundReference} from './clip-alignment.mjs';
import {admitObservation,fitGroundPlane,projectGroundPoint} from './place.mjs';
import {normalizeBoundary} from './boundary.mjs';
import {extractImageAppearance} from './appearance.mjs';
const unique=()=>globalThis.crypto.randomUUID();
const el=(tag,attrs={},content='')=>{const e=document.createElement(tag);Object.assign(e,attrs);if(content)e.textContent=content;return e;};
/** Local photo -> calibrated annotations -> authoritative continuing place. No uploads/raw persistence. */
export function mountObservationEditor(container,{place,getPlace=()=>place,onCommit,onClose=()=>{}}){
 if(!container||typeof onCommit!=='function')throw new TypeError('Container and onCommit are required');
 let alive=true,generation=0,source=null,image=null,clip=null,clipDuration=null,selectedMoment=null,scanController=null,scanViews=[],groundController=null,groundProposal=null,groundCarry=null,corners=[],extraControls=[],choosingControlPoint=false,features=[],pending=null,busy=false,url=null,pendingAppearance=null,choosingRegion=false,regionStart=null,regionPreview=null,ignoreNextClick=false,tracingBoundary=false,boundaryDraft=[],pendingBoundary=null;
 const root=el('section',{className:'observation-editor'}),heading=el('h2',{},'Bring a place into view');
 const info=el('p',{},'Choose a permitted photo or a selected moment from a local video, mark a known patch of ground, then mark its landmarks. Geometry is interpreted from your annotations; hidden structure is not recovered.');
 const status=el('p',{className:'observation-status'});status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const form=el('form'),fieldset=el('fieldset'),legend=el('legend',{},'Source and ground reference');fieldset.append(legend);
 const fields=[];
 function field(label,type,value,options={}){const wrap=el('label',{className:'observation-field'}),input=el('input',{type,value,...options});wrap.append(el('span',{},label),input);fields.push(input);return {wrap,input};}
 function select(label,choices){const wrap=el('label',{className:'observation-field'}),input=el('select');for(const [value,name] of choices)input.append(el('option',{value},name));wrap.append(el('span',{},label),input);fields.push(input);return {wrap,input};}
 const file=field('Local photo or video','file','',{accept:'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime'}),rights=field('I may use this source and its derived place','checkbox','');
 const width=field('Ground rectangle width (meters)','number','8',{min:'.01',max:'1000',step:'any',required:true});
 const depth=field('Ground rectangle depth (meters)','number','6',{min:'.01',max:'1000',step:'any',required:true});
 const captured=field('Recording date and time (optional)','datetime-local','');
 const offset=field('Recording UTC offset if time supplied','text','',{placeholder:'+00:00',maxLength:6});
 const cameraFov=field('Assumed camera vertical field of view (degrees)','number','55',{min:15,max:110,step:'any'});
 const moment=field('Video moment (seconds)','number','0',{min:0,step:'.001'}),useMoment=el('button',{type:'button'},'Use this video frame');
 const scan=el('button',{type:'button'},'Find distinct views'),cancelScan=el('button',{type:'button',hidden:true},'Cancel scan');
 const viewSection=el('section',{className:'observation-view-section',hidden:true}),viewGallery=el('div',{className:'observation-views'}),viewNote=el('p');
 viewSection.append(el('h3',{},'Views from this clip'),viewNote,viewGallery);
 const momentRow=el('div',{className:'observation-row'});momentRow.hidden=true;momentRow.append(moment.wrap,useMoment,scan,cancelScan,el('p',{},'Changing the chosen frame clears unsaved marks. Reopen the same clip to annotate another moment in this place.'));fields.push(useMoment,scan);
 const groundSelect=select('Reviewed ground reference',[]),carry=el('button',{type:'button'},'Find this ground patch'),cancelCarry=el('button',{type:'button',hidden:true},'Cancel ground tracking');
 const applyGround=el('button',{type:'button',hidden:true},'Use these four ground corners'),discardGround=el('button',{type:'button',hidden:true},'Discard proposed corners');fields.push(carry,applyGround,discardGround);
 const groundSection=el('section',{className:'observation-ground-carry',hidden:true}),groundNote=el('p',{},'Optional: carry a saved ground patch to a nearby moment in this same clip. Review the four suggested corners before using them.');
 const groundActions=el('div',{className:'observation-row'});groundActions.append(carry,cancelCarry,applyGround,discardGround);groundSection.append(el('h3',{},'Keep the same ground reference'),groundSelect.wrap,groundNote,groundActions);
 const cornerHelp=el('p',{},'Mark four visible ground corners in order: near-left, near-right, far-right, far-left. Width follows the first edge; depth follows the next. Use the same ground reference for later photos. Heights and sizes are your estimates.');
 const canvas=el('canvas',{width:960,height:600,className:'observation-image'});canvas.setAttribute('aria-label','Selected source frame with ground controls and landmark marks');
 const coords=el('div',{className:'observation-row'}),u=field('Image X (0 left–1 right)','number','.5',{min:0,max:1,step:'any'}),v=field('Image Y (0 top–1 bottom)','number','.5',{min:0,max:1,step:'any'});
 const mark=el('button',{type:'button'},'Mark point'),reset=el('button',{type:'button'},'Reset ground corners');fields.push(mark,reset);coords.append(u.wrap,v.wrap,mark,reset);
 const checkX=field('Additional ground X (meters)','number','0',{step:'any',min:-1000,max:1000}),checkZ=field('Additional ground Z (meters)','number','0',{step:'any',min:-1000,max:1000});
 const selectCheck=el('button',{type:'button'},'Pick an extra image point'),addCheck=el('button',{type:'button'},'Add ground check');
 const checkStatus=el('p',{className:'observation-calibration-status'}),checkList=el('ul',{className:'observation-calibration-checks'});
 const checkSection=el('section',{className:'observation-calibration-check-section'});
 checkSection.append(el('h3',{},'Optional ground checks'),el('p',{},'If you know another point in the original image and its X/Z in meters relative to the first ground corner, choose that image location, supply ground X/Z and add it. These are your measurements, not inferred distances.'),checkX.wrap,checkZ.wrap,selectCheck,addCheck,checkStatus,checkList);fields.push(selectCheck,addCheck);
 const featureFields=el('fieldset'),featureLegend=el('legend',{},'Landmarks in this place');featureFields.append(featureLegend);
 const existing=select('Landmark identity',[['new','New landmark'],...(getPlace()?.anchors??[]).map(a=>[a.id,a.label])]);
 const kind=select('Kind',['tree','planter','water','wall','path','rock','plant','ground','bench'].map(x=>[x,x]));
 const label=field('Name','text','',{placeholder:'The leaning tree',maxLength:200});
 const height=field('Base height above ground (meters)','number','0',{min:'-1000',max:'1000',step:'any'});
 const sx=field('Width (meters)','number','1',{min:'.001',max:'1000',step:'any'}),sy=field('Height (meters)','number','2',{min:'.001',max:'1000',step:'any'}),sz=field('Depth (meters)','number','1',{min:'.001',max:'1000',step:'any'});
 const mode=select('How this view updates the place',[['refine','Refine agreeing geometry'],['change','Record a real change in the place'],['correct','Correct an earlier interpretation']]);
 const formKind=select('Plant form for sampled colors (your interpretation)',['unspecified','shrub','broadleaf','flowers','canopy'].map(x=>[x,x]));
 const rx=field('Color region left (0–1)','number','.25',{min:0,max:1,step:'any'}),ry=field('Color region top (0–1)','number','.25',{min:0,max:1,step:'any'}),rw=field('Color region width (0–1)','number','.25',{min:'.001',max:1,step:'any'}),rh=field('Color region height (0–1)','number','.25',{min:'.001',max:1,step:'any'});
 const chooseRegion=el('button',{type:'button'},'Draw a source color region'),sampleRegion=el('button',{type:'button'},'Sample region for next landmark'),clearAppearance=el('button',{type:'button'},'Clear this color sample');fields.push(chooseRegion,sampleRegion,clearAppearance);
 const appearanceStatus=el('p',{className:'observation-appearance-status'},'Optional: sample a visible leaf or canopy region to keep source colors. The plant form is your interpretation, not automatic recognition.');
 const traceBoundary=el('button',{type:'button'},'Trace ground boundary'),finishBoundary=el('button',{type:'button'},'Use this boundary'),undoBoundary=el('button',{type:'button'},'Undo boundary vertex'),clearBoundary=el('button',{type:'button'},'Do not trace this view');fields.push(traceBoundary,finishBoundary,undoBoundary,clearBoundary);
 const boundaryStatus=el('p',{className:'observation-boundary-status'},'Optional for ground, path, planter or water: trace an ordered closed edge in the calibrated plane. Heights remain your interpretation. A refinement without a new trace retains its earlier supported boundary.');
 const featureList=el('ul',{className:'observation-features'});
 const submit=el('button',{type:'submit',className:'observation-primary'},'Enter the continuing place'),close=el('button',{type:'button'},'Close');
 fieldset.append(rights.wrap,file.wrap,momentRow,viewSection,cornerHelp,width.wrap,depth.wrap,canvas,groundSection,coords,checkSection,captured.wrap,offset.wrap,cameraFov.wrap,el('p',{},'Camera view is estimated from your ground points with this declared lens assumption; it is not measured camera metadata.'));
 featureFields.append(existing.wrap,kind.wrap,label.wrap,height.wrap,sx.wrap,sy.wrap,sz.wrap,formKind.wrap,chooseRegion,rx.wrap,ry.wrap,rw.wrap,rh.wrap,sampleRegion,clearAppearance,appearanceStatus,traceBoundary,finishBoundary,undoBoundary,clearBoundary,boundaryStatus,el('p',{},'After four ground corners, each marked point adds the landmark described above. Select an existing landmark to update it without losing its identity.'),featureList,mode.wrap);
 form.append(fieldset,featureFields,status,submit,close);root.append(heading,info,form);container.append(root);
 const say=message=>{status.textContent=message;};
 const setFrozen=frozen=>{fields.forEach(f=>f.disabled=frozen);viewGallery.querySelectorAll('button').forEach(b=>b.disabled=frozen);checkList.querySelectorAll('button').forEach(b=>b.disabled=frozen||!!pending);groundSelect.input.disabled=frozen||!!groundProposal;submit.disabled=busy||!!groundProposal;};
 const points=()=>[...corners.map((image,i)=>({image,ground:[[0,0],[Number(width.input.value),0],[Number(width.input.value),Number(depth.input.value)],[0,Number(depth.input.value)]][i]})),...extraControls.map(({image,ground})=>({image:[...image],ground:[...ground]}))];
 function calibration(){const w=Number(width.input.value),d=Number(depth.input.value);if(!(w>0&&w<=1000&&d>0&&d<=1000))throw Error('Use positive ground dimensions up to 1000 meters.');if(corners.length!==4)throw Error('Mark all four ground corners first.');const turns=corners.map((a,i)=>{const b=corners[(i+1)%4],c=corners[(i+2)%4];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});if(turns.some(t=>Math.abs(t)<1e-6)||!(turns.every(t=>t>0)||turns.every(t=>t<0)))throw Error('Ground corners must form a noncrossing rectangle in image order. Reset and mark its visible corners.');return fitGroundPlane(points());}
 function refreshChecks(){
  checkList.replaceChildren();
  extraControls.forEach((p,i)=>{const row=el('li',{},`Check ${i+1}: image (${p.image.map(x=>x.toFixed(4)).join(', ')}) → ground (${p.ground.map(x=>x.toFixed(3)).join(', ')}) m `),remove=el('button',{type:'button'},'Remove check '+(i+1));remove.disabled=!!pending||busy;remove.addEventListener('click',()=>{extraControls.splice(i,1);refreshChecks();draw();say('Extra ground check removed.');});row.append(remove);checkList.append(row);});
  if(corners.length===4)try{const fit=calibration();checkStatus.textContent=`${points().length} source-ground controls; fitting disagreement ${fit.rmsMeters.toFixed(4)} m RMS. Four corners always fit exactly; this is not physical accuracy.`;}catch(error){checkStatus.textContent=error.message;}
  else checkStatus.textContent='Mark four ground corners first.';
 }
 function clearChecks(){extraControls=[];choosingControlPoint=false;selectCheck.textContent='Pick an extra image point';refreshChecks();}
 selectCheck.addEventListener('click',()=>{if(tracingBoundary||choosingRegion)return say('Finish the current boundary or color region before picking a ground check.');if(!image||corners.length!==4)return say('Choose a source and mark four ground corners first.');choosingControlPoint=!choosingControlPoint;selectCheck.textContent=choosingControlPoint?'Cancel extra image point':'Pick an extra image point';say(choosingControlPoint?'Click the extra original image point; then enter ground X/Z and choose Add ground check.':'Extra image selection cancelled.');});
 addCheck.addEventListener('click',()=>{if(!image||corners.length!==4||pending||busy)return say('Choose a source and mark four ground corners first.');
  try{const sourcePoint=[Number(u.input.value),Number(v.input.value)],ground=[Number(checkX.input.value),Number(checkZ.input.value)];
   if(!sourcePoint.every(x=>Number.isFinite(x)&&x>=0&&x<=1))throw Error('Image X/Y must be between zero and one.');
   if(!ground.every(x=>Number.isFinite(x)&&Math.abs(x)<=1000))throw Error('Ground X/Z must be finite and within ±1000 meters.');
   if(points().some(p=>Math.hypot(p.image[0]-sourcePoint[0],p.image[1]-sourcePoint[1])<1e-6))throw Error('That image point is already a control.');
   if(extraControls.length>=60)throw Error('Maximum 60 additional ground checks.');
   const candidate={image:sourcePoint,ground},fit=fitGroundPlane([...points(),candidate]),limit=Math.max(.025,.01*Math.hypot(Number(width.input.value),Number(depth.input.value)));
   if(fit.rmsMeters>limit)throw Error(`Ground-check disagreement ${fit.rmsMeters.toFixed(3)} m exceeds ${limit.toFixed(3)} m. Review the coordinates; the old checks are unchanged.`);
   extraControls.push(candidate);refreshChecks();draw();say('Additional ground check accepted. The reviewed control points will be saved with the observation.');
  }catch(error){say(error.message);}
 });
 function draw(){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);if(!image)return;ctx.drawImage(image,0,0,canvas.width,canvas.height);if(!groundProposal){if(corners.length>1){ctx.beginPath();corners.forEach(([x,y],i)=>i?ctx.lineTo(x*canvas.width,y*canvas.height):ctx.moveTo(x*canvas.width,y*canvas.height));if(corners.length===4)ctx.closePath();ctx.strokeStyle='#ffdc8b';ctx.lineWidth=3;ctx.stroke();}for(const [i,p] of [...corners,...features.map(f=>f.imagePoint)].entries()){const x=p[0]*canvas.width,y=p[1]*canvas.height;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fillStyle=i<corners.length?'#fff0b2':'#b9f3d6';ctx.fill();ctx.strokeStyle='#243c31';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 18px sans-serif';ctx.fillStyle='#fff';ctx.strokeText(String(i+1),x+11,y-8);ctx.fillText(String(i+1),x+11,y-8);}for(const [i,p] of extraControls.entries()){const x=p.image[0]*canvas.width,y=p.image[1]*canvas.height;ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fillStyle='#81e5ff';ctx.fill();ctx.strokeStyle='#173d45';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 14px sans-serif';ctx.fillStyle='#fff';ctx.strokeText('C'+(i+1),x+10,y-8);ctx.fillText('C'+(i+1),x+10,y-8);}for(const vertices of [...features.filter(f=>f.boundary).map(f=>f.boundary.imagePoints),...(pendingBoundary?[pendingBoundary]:[]),...(boundaryDraft.length?[boundaryDraft]:[])]){ctx.beginPath();vertices.forEach(([x,y],i)=>i?ctx.lineTo(x*canvas.width,y*canvas.height):ctx.moveTo(x*canvas.width,y*canvas.height));if(vertices!==boundaryDraft)ctx.closePath();ctx.strokeStyle='#ffba78';ctx.lineWidth=3;ctx.stroke();vertices.forEach(([x,y])=>{ctx.beginPath();ctx.arc(x*canvas.width,y*canvas.height,4,0,Math.PI*2);ctx.fillStyle='#ffba78';ctx.fill();});}const region=regionPreview||pendingAppearance?.region;if(region){ctx.strokeStyle='#81e5ff';ctx.lineWidth=3;ctx.strokeRect(region[0]*canvas.width,region[1]*canvas.height,region[2]*canvas.width,region[3]*canvas.height);}}if(groundProposal){ctx.beginPath();groundProposal.corners.forEach(([x,y],i)=>i?ctx.lineTo(x*canvas.width,y*canvas.height):ctx.moveTo(x*canvas.width,y*canvas.height));ctx.closePath();ctx.strokeStyle='#81e5ff';ctx.lineWidth=4;ctx.setLineDash([10,6]);ctx.stroke();ctx.setLineDash([]);groundProposal.corners.forEach(([x,y],i)=>{ctx.beginPath();ctx.arc(x*canvas.width,y*canvas.height,8,0,Math.PI*2);ctx.fillStyle='#81e5ff';ctx.fill();ctx.strokeStyle='#173d45';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 18px sans-serif';ctx.fillStyle='#fff';ctx.strokeText(String(i+1),x*canvas.width+12,y*canvas.height-9);ctx.fillText(String(i+1),x*canvas.width+12,y*canvas.height-9);});}}
 function refreshFeatures(){featureList.replaceChildren();features.forEach((f,i)=>{const row=el('li',{},`${f.label} · ${f.kind} · ${f.size.join(' × ')} m `),remove=el('button',{type:'button'},'Remove');remove.disabled=!!pending||busy;remove.addEventListener('click',()=>{features.splice(i,1);refreshFeatures();draw();});row.append(remove);featureList.append(row);});}
 function addPoint(point){if(!image||!source)return say('Choose and authorize a photo first.');if(pending||busy)return;if(!point.every(n=>Number.isFinite(n)&&n>=0&&n<=1))return say('Image coordinates must be between zero and one.');
  clearGroundProposal();
  if(choosingControlPoint){u.input.value=point[0].toFixed(6);v.input.value=point[1].toFixed(6);choosingControlPoint=false;selectCheck.textContent='Pick an extra image point';say('Image coordinate recorded, without adding a landmark. Supply ground X/Z, then Add ground check.');return;}
  if(tracingBoundary){if(boundaryDraft.length>=128)return say('Boundary vertex limit reached. Finish or undo a vertex.');boundaryDraft.push(point);boundaryStatus.textContent=`${boundaryDraft.length} boundary vertices. Continue around one edge, then choose Use this boundary.`;draw();return;}
  if(corners.length<4){corners.push(point);if(corners.length===4){try{calibration();say('Ground reference ready. Describe a landmark, then mark its base.');}catch(error){corners.pop();say(error.message);}}else say(`Ground corner ${corners.length} marked. Mark corner ${corners.length+1}.`);refreshChecks();draw();return;}
  try{calibration();if(pendingBoundary&&!['ground','path','planter','water'].includes(kind.input.value))throw Error('A ground boundary belongs to ground, path, planter or water.');const size=[sx,sy,sz].map(f=>Number(f.input.value));if(size.some(n=>!Number.isFinite(n)||n<=0||n>1000))throw Error('Use positive landmark sizes up to 1000 meters.');const h=Number(height.input.value);if(!Number.isFinite(h)||Math.abs(h)>1000)throw Error('Base height is invalid.');const name=label.input.value.trim();if(!name)throw Error('Name this landmark before marking it.');const anchorId=existing.input.value==='new'?`anchor-${unique()}`:existing.input.value;if(features.some(f=>f.anchorId===anchorId))throw Error('This landmark is already marked; remove its earlier mark to correct it.');const prior=getPlace().anchors.find(a=>a.id===anchorId);if(!pendingAppearance&&formKind.input.value!=='unspecified'&&!(mode.input.value==='refine'&&prior?.appearance?.interpretation?.form===formKind.input.value))throw Error('Sample a source region to apply this plant form, or choose unspecified before marking the landmark.');features.push({anchorId,kind:kind.input.value,label:name,imagePoint:point,height:h,size,confidence:.7,...(pendingBoundary?{boundary:{version:1,imagePoints:structuredClone(pendingBoundary)}}:{}),...(pendingAppearance?{appearance:{...pendingAppearance,interpretation:{form:formKind.input.value}}}:{})});pendingBoundary=null;boundaryDraft=[];boundaryStatus.textContent='Landmark marked. A fresh trace is required for another new boundary.';pendingAppearance=null;regionPreview=null;appearanceStatus.textContent='Landmark marked. Select a fresh color region for another landmark, or keep artistic colors.';refreshFeatures();draw();say(`${name} marked. Add another landmark or enter the place.`);}catch(error){say(error.message);}}
 canvas.addEventListener('click',event=>{if(choosingRegion)return;if(ignoreNextClick){ignoreNextClick=false;return;}const rect=canvas.getBoundingClientRect();const point=[(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height];u.input.value=point[0].toFixed(4);v.input.value=point[1].toFixed(4);addPoint(point);});
 const canvasPoint=event=>{const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))];};
 function sampleAppearance(){if(!image||busy||pending)return;try{const region=[rx,ry,rw,rh].map(f=>Number(f.input.value));pendingAppearance=extractImageAppearance(image,{region,form:formKind.input.value});regionPreview=null;choosingRegion=false;regionStart=null;chooseRegion.textContent='Draw a source color region';appearanceStatus.textContent=`Source colors sampled for the next landmark: ${pendingAppearance.pixels.palette.map(p=>p.color).join(', ')}. These are pixels in your region, not a segmented object.`;draw();}catch(error){pendingAppearance=null;regionPreview=null;appearanceStatus.textContent=error.message;draw();}}
 chooseRegion.addEventListener('click',()=>{choosingControlPoint=false;selectCheck.textContent='Pick an extra image point';if(tracingBoundary)return say('Finish or clear the ground boundary before selecting source colors.');if(!image)return say('Choose a photo first.');choosingRegion=!choosingRegion;regionStart=null;regionPreview=null;chooseRegion.textContent=choosingRegion?'Cancel region selection':'Draw a source color region';say(choosingRegion?'Drag over a visible leaf or canopy region. Numeric region fields are the keyboard alternative.':'Landmark point marking restored.');});
 canvas.addEventListener('pointerdown',event=>{if(!choosingRegion||busy||pending)return;regionStart=canvasPoint(event);canvas.setPointerCapture(event.pointerId);});
 canvas.addEventListener('pointermove',event=>{if(!choosingRegion||!regionStart)return;const p=canvasPoint(event);regionPreview=[Math.min(p[0],regionStart[0]),Math.min(p[1],regionStart[1]),Math.abs(p[0]-regionStart[0]),Math.abs(p[1]-regionStart[1])];draw();});
 canvas.addEventListener('pointerup',event=>{if(!choosingRegion||!regionStart)return;const p=canvasPoint(event),region=[Math.min(p[0],regionStart[0]),Math.min(p[1],regionStart[1]),Math.abs(p[0]-regionStart[0]),Math.abs(p[1]-regionStart[1])];[rx,ry,rw,rh].forEach((f,i)=>f.input.value=String(region[i]));choosingRegion=false;regionStart=null;ignoreNextClick=true;chooseRegion.textContent='Draw a source color region';sampleAppearance();});
 canvas.addEventListener('pointercancel',()=>{regionStart=null;regionPreview=null;draw();});
 sampleRegion.addEventListener('click',sampleAppearance);clearAppearance.addEventListener('click',()=>{pendingAppearance=null;regionPreview=null;choosingRegion=false;regionStart=null;chooseRegion.textContent='Draw a source color region';formKind.input.value='unspecified';appearanceStatus.textContent=existing.input.value!=='new'&&mode.input.value==='refine'?'This view supplies no new appearance. Refinement retains earlier source-backed colors and form; choose a correction or change to replace them with artistic defaults.':'The next landmark will use artistic default colors and form.';draw();});
 traceBoundary.addEventListener('click',()=>{choosingControlPoint=false;selectCheck.textContent='Pick an extra image point';if(!image)return say('Choose a photo first.');if(!['ground','path','planter','water'].includes(kind.input.value))return say('Choose ground, path, planter or water before tracing.');try{calibration();}catch(error){return say(error.message);}tracingBoundary=true;boundaryDraft=[];pendingBoundary=null;choosingRegion=false;regionStart=null;regionPreview=null;chooseRegion.textContent='Draw a source color region';boundaryStatus.textContent='Mark vertices in order around one boundary. Numeric Image X/Y and Mark point are the keyboard alternative.';draw();});
 finishBoundary.addEventListener('click',()=>{try{const cal=calibration();normalizeBoundary({version:1,imagePoints:boundaryDraft},{position:[0,0,0],matrix:cal.matrix,project:p=>projectGroundPoint(cal.matrix,p)});pendingBoundary=structuredClone(boundaryDraft);boundaryDraft=[];tracingBoundary=false;boundaryStatus.textContent='Boundary ready. Mark the landmark anchor point inside or near it; that stable point carries memories.';draw();}catch(error){boundaryStatus.textContent=error.message;}});
 undoBoundary.addEventListener('click',()=>{if(!tracingBoundary&&pendingBoundary){boundaryDraft=structuredClone(pendingBoundary);pendingBoundary=null;tracingBoundary=true;}boundaryDraft.pop();boundaryStatus.textContent=`${boundaryDraft.length} boundary vertices remain.`;draw();});
 clearBoundary.addEventListener('click',()=>{boundaryDraft=[];pendingBoundary=null;tracingBoundary=false;boundaryStatus.textContent='This view has no new trace. Refinement retains an earlier source-backed boundary; correction/change without a trace returns to rectangular extent.';draw();});
 mark.addEventListener('click',()=>addPoint([Number(u.input.value),Number(v.input.value)]));
 reset.addEventListener('click',()=>{clearGroundProposal();groundCarry=null;corners=[];clearChecks();features=[];pendingBoundary=null;boundaryDraft=[];tracingBoundary=false;pendingAppearance=null;regionPreview=null;choosingRegion=false;regionStart=null;chooseRegion.textContent='Draw a source color region';appearanceStatus.textContent='Ground reset. Select a fresh source region for the next landmark.';refreshFeatures();draw();say('Ground reference reset. Mark the near-left corner.');});
 existing.input.addEventListener('change',()=>{pendingBoundary=null;boundaryDraft=[];tracingBoundary=false;boundaryStatus.textContent='Trace a new source boundary, or retain the earlier one through refinement.';const a=getPlace().anchors.find(a=>a.id===existing.input.value);pendingAppearance=null;regionPreview=null;appearanceStatus.textContent='Sample a region from this photo to update colors, or retain earlier source-backed appearance through refinement.';if(a){formKind.input.value=a.appearance?.interpretation?.form??'unspecified';label.input.value=a.label;kind.input.value=a.kind;height.input.value=a.position[1];[sx,sy,sz].forEach((f,i)=>f.input.value=a.size[i]);}});
 for(const f of [width,depth])f.input.addEventListener('change',()=>{clearGroundProposal();if(extraControls.length)clearChecks();if(corners.length===4)try{calibration();say('Ground dimensions updated. All landmarks use this calibration.');}catch(error){say(error.message);}});
 function clearGroundProposal(){groundProposal=null;carry.hidden=false;applyGround.hidden=true;discardGround.hidden=true;groundNote.textContent='Optional: carry a saved ground patch to a nearby moment in this same clip. Review the four suggested corners before using them.';draw();setFrozen(busy||!!pending);}
 function refreshGroundReferences(){const choices=source?.kind==='video'?groundReferences(getPlace(),source.sourceId,selectedMoment):[],previous=groundSelect.input.value;groundSelect.input.replaceChildren(...choices.map(r=>el('option',{value:r.id},r.offsetSeconds.toFixed(2)+' seconds · '+r.width+' × '+r.depth+' m')));if(choices.some(r=>r.id===previous))groundSelect.input.value=previous;groundSection.hidden=!choices.length;return choices;}
 groundSelect.input.addEventListener('change',()=>clearGroundProposal());
 cancelCarry.addEventListener('click',()=>groundController?.abort());
 discardGround.addEventListener('click',()=>{clearGroundProposal();say('Proposed corners discarded. Your frame and earlier marks are unchanged.');});
 carry.addEventListener('click',async()=>{
  if(!clip||busy||pending||!alive)return;
  if(!moment.input.value.trim()||Math.abs(Number(moment.input.value)-selectedMoment)>.001)return say('Use this video frame before finding its ground patch.');
  const reference=groundReferences(getPlace(),source.sourceId,selectedMoment).find(r=>r.id===groundSelect.input.value);
  if(!reference)return say('Choose a reviewed reference within eight seconds in this exact clip.');
  clearGroundProposal();const token=++generation,controller=new AbortController();groundController=controller;busy=true;setFrozen(true);cancelCarry.hidden=false;say('Finding the same ground patch locally…');
  try{
   const result=await carryGroundReference(clip,{reference,sourceId:source.sourceId,targetImage:image,targetOffset:selectedMoment,signal:controller.signal,onProgress:(done,total)=>{if(alive&&token===generation)say('Following the ground patch… '+Math.round(100*done/total)+'%');}});
   if(!alive||token!==generation)return;
   if(!groundReferences(getPlace(),source.sourceId,selectedMoment).some(r=>r.id===result.referenceId))throw Error('The reviewed reference is no longer in this place. Mark the corners yourself.');
   groundProposal=result;carry.hidden=true;applyGround.hidden=false;discardGround.hidden=false;groundNote.textContent='Check the four dashed corners on the frame above. Use them only if they still mark the same ground patch. Applying them replaces unsaved marks.';draw();canvas.scrollIntoView({block:'center'});say('Review the four dashed blue corners on the selected frame. Use them only if they still mark the same ground patch. Using them replaces unsaved corners and landmark marks.');
  }catch(error){if(alive&&token===generation)say(error.name==='AbortError'?'Ground tracking cancelled. Your frame and marks are unchanged.':error.message);}
  finally{if(alive&&token===generation){groundController=null;cancelCarry.hidden=true;busy=false;setFrozen(false);}}
 });
 applyGround.addEventListener('click',()=>{
  if(!groundProposal||busy||pending)return;
  const proposal=groundProposal,reference=groundReferences(getPlace(),source?.sourceId,selectedMoment).find(r=>r.id===proposal.referenceId);
  if(!reference||proposal.sourceId!==source.sourceId||proposal.targetOffset!==selectedMoment){clearGroundProposal();return say('The source or reviewed reference changed. Find the patch again.');}
  try{fitGroundPlane(proposal.corners.map((image,i)=>({image,ground:[[0,0],[reference.width,0],[reference.width,reference.depth],[0,reference.depth]][i]})));}
  catch(error){return say(error.message);}
  corners=structuredClone(proposal.corners);clearChecks();width.input.value=String(reference.width);depth.input.value=String(reference.depth);if(Number.isFinite(reference.verticalFovDegrees))cameraFov.input.value=String(reference.verticalFovDegrees);
  features=[];pendingAppearance=null;pendingBoundary=null;boundaryDraft=[];tracingBoundary=false;choosingRegion=false;regionPreview=null;regionStart=null;ignoreNextClick=false;chooseRegion.textContent='Draw a source color region';
  appearanceStatus.textContent='Select a fresh source region for this frame.';boundaryStatus.textContent='Trace a new source boundary for this frame, or retain an earlier one through refinement.';
  groundCarry={referenceId:proposal.referenceId,referenceOffset:proposal.referenceOffset,sourceId:proposal.sourceId,targetOffset:selectedMoment};clearGroundProposal();refreshFeatures();draw();say('Reviewed ground corners applied. Check the dimensions, then describe and mark a landmark in this frame.');
 });
 function clearViews(){for(const view of scanViews){view.image.width=0;view.image.height=0;}scanViews=[];viewGallery.replaceChildren();viewSection.hidden=true;}
 function release(){
  scanController?.abort();scanController=null;cancelScan.hidden=true;clearViews();groundController?.abort();groundController=null;cancelCarry.hidden=true;clearGroundProposal();groundCarry=null;groundSection.hidden=true;
  if(clip){clip.pause();clip.removeAttribute('src');clip.load();clip=null;}
  clipDuration=null;selectedMoment=null;momentRow.hidden=true;
  if(url){URL.revokeObjectURL(url);url=null;}
 }
 async function chooseClipMoment(seconds){
  if(!clip||busy||pending||!alive)return;
  const token=++generation;busy=true;setFrozen(true);
  try{
   if(seconds===null)throw Error('Enter a clip moment in seconds.');
   const frame=await captureClipFrame(clip,seconds);
   if(!alive||token!==generation)return;
   image=frame.image;selectedMoment=frame.offsetSeconds;moment.input.value=selectedMoment.toFixed(3);
   clearGroundProposal();groundCarry=null;corners=[];clearChecks();features=[];pendingAppearance=null;pendingBoundary=null;boundaryDraft=[];tracingBoundary=false;choosingRegion=false;regionPreview=null;regionStart=null;ignoreNextClick=false;
   chooseRegion.textContent='Draw a source color region';appearanceStatus.textContent='Select a fresh source region for this frame.';boundaryStatus.textContent='Trace a new source boundary for this frame, or keep the landmark extent through refinement.';
   refreshFeatures();refreshGroundReferences();draw();say('Video frame ready at '+selectedMoment.toFixed(2)+' seconds. Mark the near-left ground corner.');
  }catch(error){if(alive&&token===generation)say(error.message);}
  finally{if(alive&&token===generation){busy=false;setFrozen(false);}}
 }
 useMoment.addEventListener('click',()=>chooseClipMoment(moment.input.value.trim()?Number(moment.input.value):null));
 cancelScan.addEventListener('click',()=>scanController?.abort());
 scan.addEventListener('click',async()=>{
  if(!clip||busy||pending||!alive)return;
  const token=++generation,controller=new AbortController();scanController=controller;busy=true;setFrozen(true);cancelScan.hidden=false;say('Looking through this clip for distinct views…');
  try{
   const result=await scanClipViews(clip,{signal:controller.signal,onProgress:(done,total)=>{if(alive&&token===generation)say('Looking through this clip… '+Math.round(100*done/total)+'%');}});
   if(!alive||token!==generation){for(const view of result.candidates){view.image.width=0;view.image.height=0;}return;}
   clearViews();scanViews=result.candidates;
   for(const view of scanViews){
    const choice=el('button',{type:'button',className:'observation-view-choice'});choice.setAttribute('aria-label','Use view at '+view.offsetSeconds.toFixed(2)+' seconds');
    view.image.setAttribute('aria-hidden','true');choice.append(view.image,el('span',{},view.offsetSeconds.toFixed(2)+' seconds'));
    choice.addEventListener('click',async()=>{await chooseClipMoment(view.offsetSeconds);if(alive)canvas.scrollIntoView({block:'center'});});viewGallery.append(choice);
   }
   viewNote.textContent='These sampled views are suggestions. Choosing one resets unsaved marks; it does not add an observation.';
   viewSection.hidden=false;
   say('Found '+scanViews.length+' distinct '+(scanViews.length===1?'view':'views')+'. '+(result.incomplete?'The scan stopped early; you can also choose a moment yourself.':'Your selected frame and marks are unchanged.'));
  }catch(error){if(alive&&token===generation)say(error.name==='AbortError'?'Scan cancelled. Your selected frame and marks are unchanged.':error.message);}
  finally{if(alive&&token===generation){scanController=null;cancelScan.hidden=true;busy=false;setFrozen(false);}}
 });
 file.input.addEventListener('change',async()=>{
  const token=++generation;release();source=null;image=null;corners=[];clearChecks();features=[];pending=null;pendingBoundary=null;boundaryDraft=[];tracingBoundary=false;pendingAppearance=null;regionPreview=null;choosingRegion=false;regionStart=null;chooseRegion.textContent='Draw a source color region';appearanceStatus.textContent='Select a fresh source region for this frame.';refreshFeatures();draw();
  const selected=file.input.files?.[0];if(!selected)return;if(!rights.input.checked){file.input.value='';return say('Acknowledge permission before choosing the source.');}
  busy=true;setFrozen(true);say('Checking the selected source locally…');
  try{
   const identified=await identifyMedia(selected);if(!alive||token!==generation)return;
   url=URL.createObjectURL(selected);
   if(identified.kind==='photo'){
    const img=new Image();img.src=url;await img.decode();
    if(!alive||token!==generation)return;
    if(img.naturalWidth*img.naturalHeight>50000000)throw Error('Choose a photo smaller than 50 megapixels.');
    image=img;
   }else if(identified.kind==='video'){
    clip=document.createElement('video');clip.muted=true;clip.playsInline=true;clip.preload='auto';clip.src=url;
    clipDuration=await loadClipMetadata(clip);
    if(!alive||token!==generation)return;
    momentRow.hidden=false;moment.input.max=String(clipDuration);moment.input.value='0';
    const frame=await captureClipFrame(clip,0);
    if(!alive||token!==generation)return;
    image=frame.image;selectedMoment=frame.offsetSeconds;moment.input.value=selectedMoment.toFixed(3);
   }else throw Error('Choose a supported local photo or video.');
   source=identified;refreshGroundReferences();
   const scale=Math.min(1,1280/image.naturalWidth);canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
   draw();say(identified.kind==='video'?'Video frame ready at '+selectedMoment.toFixed(2)+' seconds. Mark the near-left ground corner.':'Photo ready. Mark the near-left ground corner.');
  }catch(error){if(alive&&token===generation){image=null;source=null;release();say(error.message);}}finally{if(alive&&token===generation){if(source?.kind!=='video')release();busy=false;setFrozen(false);file.input.value='';}}
 });
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!alive)return;let attemptedCommit=false;
  try{if(groundProposal)throw Error('Use or discard the proposed ground corners before saving.');if(groundCarry&&!groundReferences(getPlace(),source?.sourceId,selectedMoment).some(r=>r.id===groundCarry.referenceId))throw Error('The reviewed ground reference is no longer in this place. Mark the corners again.');if(!pending){if(!source||!rights.input.checked)throw Error('Select an authorized source first.');if(source.kind==='video'&&(!Number.isFinite(selectedMoment)||!moment.input.value.trim()||Math.abs(Number(moment.input.value)-selectedMoment)>.001))throw Error('Use this video frame before saving its landmarks.');calibration();if(!features.length)throw Error('Mark at least one landmark.');pending={id:`observation-${unique()}`,authorized:true,source:{id:source.sourceId,kind:source.kind,label:source.kind==='video'?'Locally reviewed clip moment':'Locally reviewed place photo',capturedAt:captureTimestamp(captured.input.value,offset.input.value),...(source.kind==='video'?{offsetSeconds:selectedMoment}:{})},mode:mode.input.value,controlPoints:points(),cameraAssumption:{verticalFovDegrees:Number(cameraFov.input.value),imageAspect:image.naturalWidth/image.naturalHeight},features:structuredClone(features),notes:'Interpreted geometry from a selected local source frame and explicit human annotations; dimensions and ground reference supplied by the visitor.'+(groundCarry?' Ground corner suggestions matched from reviewed observation '+groundCarry.referenceId+' at '+groundCarry.referenceOffset+' seconds in this exact clip and explicitly reviewed by the visitor; saved dimensions are visitor values.':'')};}
   busy=true;setFrozen(true);refreshFeatures();say('Saving this observation into the continuing place…');const next=admitObservation(getPlace(),pending);attemptedCommit=true;await onCommit(next);if(!alive)return;pending=null;say('Observation saved. The same place is ready to revisit.');onClose();
  }catch(error){if(alive){if(!attemptedCommit)pending=null;say(`${error.message}${pending?' The unchanged observation is kept here for retry.':''}`);submit.textContent=pending?'Retry this observation':'Enter the continuing place';}}
  finally{if(alive){busy=false;setFrozen(!!pending);refreshFeatures();}}
 });
 close.addEventListener('click',()=>onClose());
 return {dispose(){alive=false;generation++;release();image=null;source=null;pending=null;root.remove();}};
}

