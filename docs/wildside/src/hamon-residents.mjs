/** Simulated residents and the third-person traveller for the HAMON view.
 *
 * Wildside decides where life is plausible from the place's own interpreted anchors: squirrels
 * and songbirds only where there are trees, rabbits only on open grass, butterflies only over
 * flower beds, gulls only over open water large enough to hold them. The Engine
 * (`hamon_sculpt::residents`, kind `residents` in native/hamon-browser) builds the library
 * creatures and runs their behaviour at a fixed tick in wasm; this module streams only the
 * visitor. Everything here is simulated: it illustrates what the habitat could support and is
 * never recorded as an observation, a sighting or a returning individual.
 */
import * as THREE from '../vendor/three.module.js';
import {liveIdOf} from './hamon-places.mjs';

export const RESIDENTS_KEY='wildside.hamon.residents.v1';
export const TRAVELLER_KEY='wildside.hamon.traveller.v1';
const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const write=(key,value)=>{try{value===null?localStorage.removeItem(key):localStorage.setItem(key,value);}catch{}};

/** Species the Engine library offers, by where a place's public context places it. North
 * American songbirds and the monarch are used only where no context says otherwise, or the
 * context is North American; elsewhere the generic look-alikes (a tit-like chickadee, a dove,
 * a swallowtail) stand in, and every label stays generic. */
const NORTH_AMERICA=/\b(arizona|florida|united states|usa|canada|mexico|national park)\b/i;
function speciesSet(region){
 if(!region||NORTH_AMERICA.test(region))return {songbirds:['chickadee','cardinal','goldfinch','blue-jay'],butterflies:['monarch','swallowtail']};
 return {songbirds:['chickadee','mourning-dove'],butterflies:['swallowtail']};
}

const seedOf=id=>[...String(id)].reduce((s,c)=>(s*31+c.charCodeAt(0))>>>0,7);
const rectOf=(a,m=0)=>{const [x,,z]=a.position,[w,,d]=a.size;return [x-w/2-m,z-d/2-m,x+w/2+m,z+d/2+m];};
const inside=(r,x,z)=>x>r[0]&&x<r[2]&&z>r[1]&&z<r[3];
const area=a=>a.size[0]*a.size[2];

/** The place's public habitat context, if any. */
function contextOf(place){
 const o=[...(place.observations??[])].reverse().find(v=>v.geographicContext);
 return o?.geographicContext??null;
}

/** Ground heights over the place bounds, coarse enough to stay small. */
export function sampleGround(art){
 const b=art.bounds,spanX=b.max[0]-b.min[0],spanZ=b.max[2]-b.min[2];
 const cell=Math.max(.5,Math.max(spanX,spanZ)/48),nx=Math.min(64,Math.max(2,Math.ceil(spanX/cell)+1)),nz=Math.min(64,Math.max(2,Math.ceil(spanZ/cell)+1));
 const h=[];for(let k=0;k<nz;k++)for(let i=0;i<nx;i++){const y=art.groundAt?.(b.min[0]+i*cell,b.min[2]+k*cell);h.push(Number.isFinite(y)?Math.round(y*1000)/1000:0);}
 return {origin:[b.min[0],b.min[2]],cell,nx,nz,h};
}

/** Where life is plausible in `place` and who lives there. Pure and deterministic.
 * Returns {habitat, residents, notes}: `residents` carry a human-readable `where` for the
 * disclosure; `notes` explain kinds that were left out. */
export function planResidents(place,art){
 const anchors=place?.anchors??[],context=contextOf(place),habitatKind=context?.profileId??null;
 const region=context?.region??null,set=speciesSet(region);
 const trees=[],treeAnchors=[],flowers=[],water=[],keepOut=[],lawns=[],residents=[],notes=[];
 for(const a of anchors){
  const [x,y,z]=a.position,[w,h,d]=a.size,form=a.appearance?.interpretation?.form;
  if(a.kind==='tree'||form==='canopy'){
   // the same crown the Engine forest plants (hamon-scene-export.mjs)
   trees.push([x,y,z,Math.max(.4,Math.max(w,d)*.42),Math.max(1,h*.68)]);treeAnchors.push(a);
   keepOut.push([x-.3,z-.3,x+.3,z+.3]);continue;
  }
  if(['wall','water','building','bench','rock','planter'].includes(a.kind))keepOut.push(rectOf(a,.1));
  if(a.kind==='water')water.push({rect:rectOf(a),y:y+h,anchor:a});
  if(a.kind==='ground'&&!['marsh-substrate','desert-ground'].includes(a.contextForm)&&area(a)>=4)lawns.push(a);
  if(a.kind==='plant'&&!['shrub','broadleaf','sedge','columnar-succulent'].includes(form)&&!['sedge','columnar-succulent'].includes(a.contextForm))flowers.push({rect:rectOf(a),y,anchor:a});
 }
 const label=a=>a.label??a.kind;
 // squirrels: one per tree that is tall enough to climb, at most two
 trees.map((t,i)=>({t,i})).filter(({t})=>t[4]>=2.2).sort((a,b)=>b.t[3]-a.t[3]).slice(0,2).forEach(({t,i})=>{
  residents.push({kind:'squirrel',home:[t[0]+.6,t[1],t[2]+.4],radius:Math.min(3,Math.max(1.6,t[3]*1.3)),tree:i,seed:seedOf(treeAnchors[i].id)+1,where:`around ${label(treeAnchors[i])}`});
 });
 // songbirds: in the crowns, one per tree (two for a lone tree), at most three
 const birdCount=Math.min(3,trees.length===1?2:trees.length);
 for(let k=0;k<birdCount;k++){const i=k%trees.length,t=trees[i],s=seedOf(treeAnchors[i].id)+11*k;
  residents.push({kind:'songbird',species:set.songbirds[s%set.songbirds.length],home:[t[0],t[1]+t[4],t[2]],radius:t[3],tree:i,seed:s,where:`in the crown of ${label(treeAnchors[i])}`});}
 if(!trees.length)notes.push('No trees here, so no squirrels or songbirds.');
 // rabbits: on open grass, clear of walls, water and furniture
 const blocked=(x,z)=>keepOut.some(r=>inside(r,x,z));
 let rabbits=0;
 for(const g of lawns){
  if(rabbits>=2)break;
  const r=rectOf(g,-.4),s=seedOf(g.id);let best=null;
  for(let k=0;k<64;k++){
   const u=((k*0.61803398875+s*1e-4)%1),v=((k*0.41421356+s*7e-5)%1),x=r[0]+(r[2]-r[0])*u,z=r[1]+(r[3]-r[1])*v;
   let rad=0;for(const c of [.6,1,1.4,1.8,2.2]){if([...Array(8)].every((_,j)=>{const a=j*Math.PI/4,px=x+Math.cos(a)*c,pz=z+Math.sin(a)*c;return inside(rectOf(g),px,pz)&&!blocked(px,pz);})&&!blocked(x,z))rad=c;else break;}
   if(rad>=1&&(!best||rad>best.rad))best={x,z,rad};
  }
  if(best){residents.push({kind:'rabbit',home:[best.x,g.position[1]+g.size[1],best.z],radius:best.rad,seed:s+rabbits,where:`on the open grass of ${label(g)}`});rabbits++;}
 }
 if(!rabbits)notes.push(habitatKind?'No open grass in this habitat interpretation, so no rabbits.':'No open grass large enough for a rabbit.');
 // butterflies: over flower beds, one per bed (two over a large one), at most three
 let flutter=0;
 for(const f of flowers){for(let k=0;k<(area(f.anchor)>1.5?2:1)&&flutter<3;k++,flutter++){const s=seedOf(f.anchor.id)+k;residents.push({kind:'butterfly',species:set.butterflies[s%set.butterflies.length],home:[(f.rect[0]+f.rect[2])/2,f.y,(f.rect[1]+f.rect[3])/2],radius:1.5,seed:s,where:`over ${label(f.anchor)}`});}}
 if(!flowers.length)notes.push('No flower beds, so no butterflies.');
 // gulls: only over open water of at least ~40 m² (a rain pool is not a gull's place)
 const open=water.filter(w=>area(w.anchor)>=40).sort((a,b)=>area(b.anchor)-area(a.anchor));
 open.slice(0,1).forEach(w=>{const n=area(w.anchor)>=150?2:1;for(let k=0;k<n;k++){const s=seedOf(w.anchor.id)+k;residents.push({kind:'gull',home:[(w.rect[0]+w.rect[2])/2,w.y,(w.rect[1]+w.rect[3])/2],radius:Math.min(w.rect[2]-w.rect[0],w.rect[3]-w.rect[1])/2,seed:s,where:`over ${label(w.anchor)}`});}});
 if(!open.length)notes.push(water.length?'The water here is too small for gulls.':'No open water, so no gulls.');
 const habitat={trees,flowers:flowers.map(f=>[...f.rect,f.y]),water:water.map(w=>[...w.rect,w.y]),keepOut,ground:art?sampleGround(art):{origin:[0,0],cell:1,nx:1,nz:1,h:[0]}};
 return {habitat,residents,notes,region};
}

const NAMES={squirrel:'squirrel',rabbit:'rabbit',songbird:'songbird',butterfly:'butterfly',gull:'gull'};
/** Disclosure line for one resident ("Simulated squirrel · around The leaning tree"). */
export const residentLine=r=>`Simulated ${NAMES[r.kind]} · ${r.where}`;

/** Wildside nav yaw (forward = sin, -cos) to the Engine human's yaw (forward = sin, cos). */
export const travellerYaw=navYaw=>Math.PI-navYaw;

/** Residents + traveller controller. `onChange()` asks the host to resend the world (turning
 * residents or the traveller on/off changes the Engine scene). */
export function createHamonResidents({onChange=()=>{},location=globalThis.location}={}){
 const changed=()=>api.onChange();
 const q=new URLSearchParams(location?.search??'');
 if(q.get('residents')==='0')write(RESIDENTS_KEY,'off');else if(q.get('residents')==='1')write(RESIDENTS_KEY,null);
 if(q.get('traveller')==='1')write(TRAVELLER_KEY,'on');else if(q.get('traveller')==='0')write(TRAVELLER_KEY,null);
 let residentsOn=read(RESIDENTS_KEY)!=='off',travellerOn=read(TRAVELLER_KEY)==='on',plan=null,following=false,ui=null;
 const residentState=new Float32Array(4),travellerState=new Float32Array(5);
 const cam=new THREE.PerspectiveCamera(),ray=new THREE.Raycaster(),head=new THREE.Vector3(),eye=new THREE.Vector3(),dir=new THREE.Vector3();
 const replan=ctx=>{plan=ctx.place?planResidents(ctx.place,ctx.art):null;ui?.render();return plan;};
 const residents={
  id:'residents',kind:'residents',
  // decided per rebuild; nothing is sent when the place supports no residents. Engine live places (hamon-places.mjs) bring their own wildlife and traveller.
  enabled:ctx=>residentsOn&&!liveIdOf(ctx.place)&&!!replan(ctx)?.residents.length,
  params:()=>({habitat:plan.habitat,residents:plan.residents.map(({where,...r})=>r)}),
  state(ctx){
   if(!globalThis.__wildsideResidents)import('../hamon/hamon_browser.js').then(m=>{globalThis.__wildsideResidents=()=>{try{return JSON.parse(m.resident_states_json());}catch{return [];}};}).catch(()=>{});
   const p=ctx.nav?.pose?.(),c=ctx.camera?.position;
   if(c)residentState.set([c.x,c.y,c.z,0]);
   // animals keep their distance from a walking visitor, not from a camera flying overhead
   if(p&&p.mode==='human'&&!p.transitioning)residentState.set([p.position[0],p.position[1],p.position[2],1]);
   return residentState;
  },
 };
 const traveller={
  id:'traveller',kind:'traveller',
  enabled:ctx=>travellerOn&&!!ctx.place&&!liveIdOf(ctx.place),
  params:ctx=>({seed:26,ground:ctx.art?sampleGround(ctx.art):undefined}),
  state(ctx){
   const p=ctx.nav?.pose?.();
   if(!p||!following){travellerState[4]=0;return travellerState;}
   travellerState.set([p.position[0],p.position[1]-p.eye,p.position[2],travellerYaw(p.yaw),1]);
   return travellerState;
  },
 };
 /** The camera the HAMON view should draw from: a follow camera behind the traveller in
  * human mode when third person is on, otherwise `camera` itself. */
 function view(camera,{nav,art,follow}){
  const p=nav?.pose?.();following=!!(travellerOn&&follow&&p&&p.mode==='human'&&!p.transitioning);
  if(!following)return camera;
  const feet=[p.position[0],p.position[1]-p.eye,p.position[2]];
  head.set(feet[0],feet[1]+1.45,feet[2]);
  dir.set(Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch));
  // over the shoulder, a little above, pulled in when a wall or crown is behind
  let dist=3.1;eye.copy(head).addScaledVector(dir,-dist).add(new THREE.Vector3(0,.45,0));
  const back=eye.clone().sub(head),len=back.length();ray.set(head,back.normalize());ray.near=.05;ray.far=len;
  const hit=art?.group?ray.intersectObjects(art.group.children,true)[0]:null;
  if(hit)eye.copy(head).addScaledVector(back,Math.max(.7,hit.distance-.25));
  eye.y=Math.max(eye.y,(art?.groundAt?.(eye.x,eye.z)??feet[1])+.35);
  cam.fov=Math.max(camera.fov,55);cam.aspect=camera.aspect;cam.near=Math.max(.05,camera.near);cam.far=camera.far;cam.updateProjectionMatrix();
  cam.position.copy(eye);cam.up.set(0,1,0);cam.lookAt(head.clone().addScaledVector(dir,1.6).add(new THREE.Vector3(0,-.15,0)));cam.updateMatrixWorld();
  return cam;
 }
 /** The resident to show in the encounter card: the nearest whose home is in front of a
  * human-scale visitor within 7 m (homes, not live positions: it lives around there). */
 function encounter(camera){
  if(!residentsOn||!plan?.residents.length||!camera)return null;
  const f=camera.getWorldDirection(new THREE.Vector3()),c=camera.position;let best=null;
  for(const r of plan.residents){const d=new THREE.Vector3(...r.home).sub(c),dist=d.length();if(dist>7||d.normalize().dot(f)<.35)continue;if(!best||dist<best.dist)best={...r,dist};}
  return best;
 }
 /** Quiet disclosure + toggles next to the style picker. */
 function mount(container){
  if(!container)return null;
  const box=document.createElement('div');box.className='resident-notes';box.hidden=true;
  const summary=document.createElement('span'),body=document.createElement('div');summary.className='ctl-label';box.append(summary,body);
  const toggle=(text,on,fn)=>{const l=document.createElement('label'),i=document.createElement('input');i.type='checkbox';i.checked=on;i.addEventListener('change',()=>fn(i.checked));l.append(i,' '+text);return l;};
  const render=()=>{
   const list=residentsOn?plan?.residents??[]:[];
   summary.textContent=residentsOn?`Simulated residents · ${list.length}`:'Simulated residents · off';
   body.replaceChildren();
   const p=document.createElement('p');p.textContent='Habitat-plausible simulated life, placed where this interpreted place has trees, grass, flowers or open water. Not a sighting, a live view, or a record of animals here.';body.append(p);
   if(list.length){const ul=document.createElement('ul');for(const r of list){const li=document.createElement('li');li.textContent=residentLine(r);ul.append(li);}body.append(ul);}
   for(const n of residentsOn?plan?.notes??[]:[]){const s=document.createElement('p');s.className='resident-note';s.textContent=n;body.append(s);}
   body.append(toggle('Show simulated residents',residentsOn,v=>{residentsOn=v;write(RESIDENTS_KEY,v?null:'off');render();changed();}));
   body.append(toggle('Third-person traveller in Human view (V)',travellerOn,v=>setTraveller(v)));
  };
  ui={box,render};render();container.append(box);return ui;
 }
 function setTraveller(v){travellerOn=!!v;write(TRAVELLER_KEY,v?'on':null);ui?.render();changed();}
 const api={onChange,
  extensions:[residents,traveller],view,encounter,mount,
  setVisible(v){if(ui)ui.box.hidden=!v;},
  refresh(){ui?.render();},
  toggleTraveller(){setTraveller(!travellerOn);},
  get plan(){return plan;},get residentsOn(){return residentsOn;},get travellerOn(){return travellerOn;},get following(){return following;},
 };
 return api;
}

/** The view's shared controller (the host sets `onChange` to resend its world). */
export const hamonResidents=createHamonResidents();
