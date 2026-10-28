/** Watch an animal from outside, or become it. This controller owns the mode, the camera choice and
 * the story progress; the host (app.mjs) supplies the simulation context and applies the camera.
 *
 *   mode 'off'      nothing; the normal Wildside views
 *   mode 'outside'  a third-person orbit that follows the animal's own life
 *   mode 'inside'   you are the animal: view 'eyes' (its own eye height) or 'shoulder' (close third person)
 *
 * Progress (what you have watched and done) is a per-viewer convenience kept in localStorage; it only
 * unlocks story beats (creature-stories.mjs) and is never sent anywhere. */
import {CREATURES,creatureById} from './embody-creatures.mjs';
import {orbitPose,shoulderPose,eyesPose,lookDirection,simYawToView} from './embody-camera.mjs';
import {creatureStory,emptyProgress,beatUnlocked,CREATURE_IDS} from './creature-stories.mjs';

export const PROGRESS_KEY='wildside.creature-progress.v1';
export const VIEWS=Object.freeze(['eyes','shoulder']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

export function createEmbodiment(deps){
  const {context,occlude=()=>null,project=()=>null,hamonActive=()=>false,onActive=()=>{},storage=null,onChange=()=>{},onUnlock=()=>{}}=deps;
  let mode='off',creature=null,view='eyes',driver=null,jump=false,act=false,run=false;
  const orbit={yaw:0,pitch:-.16,distance:1.25},focus=[0,0,0];let focusReady=false;
  let progress={};
  try{const raw=storage?.getItem(PROGRESS_KEY);if(raw)progress=JSON.parse(raw)??{};}catch{progress={};}
  const prog=id=>progress[id]??=emptyProgress();
  const persist=()=>{try{storage?.setItem(PROGRESS_KEY,JSON.stringify(progress));}catch{}};
  let dirty=0;
  const emit=()=>onChange(snapshot());

  function locate(id){const c=creatureById(id);return c?c.locate(context()):null;}
  const canObserveTime=()=>mode==='outside'&&!!creature&&!!locate(creature);
  function bump(id,key,amount,{notifyChange=true}={}){
    if(!(amount>0))return;
    const p=prog(id),story=creature&&CREATURE_IDS.includes(id)?creatureStory(id):null;
    const before=story?story.beats.map(b=>beatUnlocked(b,p)):[];
    p[key]=(p[key]??0)+amount;
    if(story)story.beats.forEach((b,i)=>{if(!before[i]&&beatUnlocked(b,p)){persist();onUnlock({creature:id,beat:b});if(notifyChange)emit();}});
  }

  function list(){
    return CREATURES.map(c=>{
      const found=c.locate(context());
      return {id:c.id,name:c.name,kind:c.kind,present:!!found,canBecome:!!c.canBecome&&hamonActive()&&!c.blocked?.(context()),becomeBlocked:c.canBecome?(!hamonActive()?'Becoming an animal needs the HAMON painted view, which needs WebGPU or WebGL2 (?hamon=1 turns it back on if it was switched off).':c.blocked?.(context())??null):null,activity:found?.activity??null,hasStory:CREATURE_IDS.includes(c.id)};
    });
  }

  function start(id,nextMode){
    const c=creatureById(id);if(!c)return {ok:false,reason:'unknown'};
    const found=c.locate(context());
    if(!found)return {ok:false,reason:'The '+c.name.toLowerCase()+' is not out right now.'};
    if(nextMode==='inside'){
      if(!c.canBecome)return {ok:false,reason:'Not yet.'};
      if(!hamonActive())return {ok:false,reason:'Becoming an animal needs the HAMON painted view, which needs WebGPU or WebGL2 (?hamon=1 turns it back on if it was switched off).'};
      const blocked=c.blocked?.(context());if(blocked)return {ok:false,reason:blocked};
      const d=c.become(context(),found);
      if(!d)return {ok:false,reason:'There is no safe space to stand where the '+c.name.toLowerCase()+' is. Try again when it moves.'};
      driver?.dispose?.();driver=d;view='eyes';
    }else{driver?.dispose?.();driver=null;}
    const first=mode==='off';
    creature=id;mode=nextMode;focusReady=false;
        // Frame it from the front three-quarters if that view is clear, else the clearest side, and
    // come closer rather than lose it behind leaves.
    const t=[found.position[0],found.position[1]+c.camera.outside.height,found.position[2]],face=simYawToView(found.yaw)+Math.PI;
    let best={room:-1,yaw:face-.75,distance:orbit.distance,pitch:orbit.pitch};
    search:for(const scale of [1,.75,.55,.4])for(const pitch of [-c.camera.outside.pitch,-.45])for(const turn of [-.75,.75,-1.6,1.6,0,Math.PI,-2.4,2.4]){
      const distance=c.camera.outside.distance*scale;
      const hit=occlude(t,t.map((v,i)=>v-lookDirection(face+turn,pitch)[i]*distance),{foliage:true});
      const room=Math.min(distance,hit===null||hit===undefined?distance:hit)/c.camera.outside.distance;
      if(room>best.room+1e-6){best={room,yaw:face+turn,distance,pitch};if(room>=scale-1e-6)break search;}
    }
    orbit.yaw=best.yaw;orbit.distance=best.distance;orbit.pitch=best.pitch;
    if(first)onActive(true);
    emit();return {ok:true};
  }

  function exit(){
    if(mode==='off')return false;
    driver?.dispose?.();driver=null;mode='off';creature=null;jump=false;act=false;run=false;
    persist();onActive(false);emit();return true;
  }

  function snapshot(){
    return {mode,creature,view,name:creature?creatureById(creature)?.name:null,controls:creature?(mode==='inside'?creatureById(creature)?.controls:'Drag to orbit \u00b7 scroll or pinch to zoom \u00b7 G for its story \u00b7 Esc to leave'):null,
      progress:Object.fromEntries(Object.entries(progress).map(([k,v])=>[k,{...v}])),list:list()};
  }

  return {
    get active(){return mode!=='off';},
    get driving(){return mode==='inside'&&!!driver;},
    get mode(){return mode;},
    get view(){return view;},
    get creature(){return creature;},
    snapshot,list,
    observe:id=>start(id,'outside'),
    become:id=>start(id,'inside'),
    exit,
    setView(next){if(mode==='inside'&&VIEWS.includes(next)){view=next;emit();}},
    cycleView(){if(mode==='inside'){view=VIEWS[(VIEWS.indexOf(view)+1)%VIEWS.length];emit();}},
    setJump(v){jump=!!v;},
    setAct(v){act=!!v;},
    setRun(v){run=!!v;},
    progress:id=>({...prog(id)}),
    /** Drag to look: yaw/pitch as inside, orbit as outside. */
    look(dx,dy){
      if(mode==='inside'){driver?.look(dx,dy);return;}
      if(mode==='outside'){orbit.yaw+=dx;orbit.pitch=clamp(orbit.pitch+dy,-1.3,.25);}
    },
    zoom(delta){
      if(mode!=='outside'||!creature)return;
      const o=creatureById(creature).camera.outside;
      orbit.distance=clamp(orbit.distance*Math.exp(delta*.0012),o.min,o.max);
    },
    /** Account for visible, stationary watching without advancing any body.
     * The host owns attention/visibility timing and refreshes only story DOM.
     * A bounded interval cannot credit a hidden or suspended catch-up gap. */
    canObserveTime,
    observeTime(dt){
      if(!Number.isFinite(dt)||dt<=0||dt>1||!canObserveTime())return false;
      bump(creature,'observe',dt,{notifyChange:false});
      dirty+=dt;if(dirty>5){dirty=0;persist();}
      return true;
    },
    /** Advance the animal you are, and the clock of what you have watched. */
    update(input,dt){
      if(mode==='off'||!creature)return;
      if(mode==='inside'&&driver){
        const moved=driver.step({...input,up:input.up+(jump?1:0),act,run},dt);
        bump(creature,'embody',dt);bump(creature,'ground',moved.ground);bump(creature,'air',moved.air);
      }else if(mode==='outside'&&locate(creature))bump(creature,'observe',dt);
      dirty+=dt;if(dirty>5){dirty=0;persist();}
    },
    /** The animal's body as the renderer should draw it while you are inside it, else null. */
    bodyState(id){return mode==='inside'&&driver&&creature===id?driver.body():null;},
    /** Place the three.js camera. Returns false when there is nothing to show. */
    applyCamera(camera,dt=1/60){
      if(mode==='off'||!creature)return false;
      const c=creatureById(creature).camera;let pose,fov,near=.02;
      if(mode==='inside'&&driver){
        const g=driver.gaze();
        if(view==='eyes'){pose=eyesPose({body:g.body,yaw:g.yaw,pitch:g.pitch,bob:g.bob,...c.eyes});fov=c.eyes.fov;near=c.eyes.near;}
        else{pose=shoulderPose({body:g.body,yaw:g.yaw,pitch:g.pitch,...c.shoulder},occlude);fov=c.shoulder.fov;near=c.shoulder.near??.02;}
      }else{
        const found=locate(creature);
        if(found){
          const t=[found.position[0],found.position[1]+c.outside.height,found.position[2]];
          if(!focusReady){focus[0]=t[0];focus[1]=t[1];focus[2]=t[2];focusReady=true;}
          else{const k=1-Math.exp(-dt*12);for(let i=0;i<3;i++)focus[i]=lerp(focus[i],t[i],k);}
        }
        pose=orbitPose({target:focus,yaw:orbit.yaw,pitch:orbit.pitch,distance:orbit.distance,minDistance:c.outside.min},(a,b)=>occlude(a,b,{foliage:true}));fov=44;near=c.outside.near??.03;
      }
      camera.up.set(0,1,0);camera.position.set(...pose.position);camera.lookAt(...pose.target);
      const aspect=camera.aspect||1;camera.fov=2*Math.atan(Math.tan(fov*Math.PI/360)/Math.min(1,aspect))*180/Math.PI;camera.near=near;camera.updateProjectionMatrix();
      return true;
    },
    /** Which animal is under a screen point (CSS px), or null. */
    pick(x,y,radius=56){
      let best=null,bestD=radius;
      for(const c of CREATURES){
        const f=c.locate(context());if(!f)continue;
        const s=project(f.position);if(!s||!s.visible)continue;
        const d=Math.hypot(s.x-x,s.y-y);if(d<bestD){bestD=d;best=c.id;}
      }
      return best;
    },
    orbitState:()=>({...orbit}),
    lookDirection,
  };
}
