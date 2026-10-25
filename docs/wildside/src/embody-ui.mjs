/** Small, self-contained chrome for watching and becoming animals. It builds its own elements and
 * talks only to the embodiment controller, so the main interface can move around it. Hooks:
 *   mountEmbodyUI(controller, {notify}) -> {dispose()}
 * Elements: #who-lives (list), #embody-bar (current mode), #embody-story (story card). */
import {creatureStory,beatUnlocked,beatProgress} from './creature-stories.mjs';

const make=(tag,text,cls,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
const button=(text,action,cls='',attrs={})=>{const b=make('button',text,cls,{type:'button',...attrs});b.addEventListener('click',action);return b;};

export function mountEmbodyUI(embody,{notify=()=>{}}={}){
  const root=make('div',undefined,'embody-root');document.body.append(root);
  const bar=make('div',undefined,'embody-bar',{id:'embody-bar',role:'status','aria-live':'polite'});
  const card=make('section',undefined,'embody-story',{id:'embody-story','aria-label':'Story'});
  root.append(bar,card);
  let storyOpen=false,beatIndex=0,fresh=null,last=embody.snapshot();

  const act=(result)=>{if(result&&!result.ok&&result.reason)notify(result.reason);};

  function renderBar(s){
    bar.hidden=s.mode==='off';card.hidden=s.mode==='off'||!storyOpen;
    bar.replaceChildren();document.body.classList.toggle('embodied',s.mode!=='off');
    if(s.mode==='off')return;
    const inside=s.mode==='inside',name=s.name.toLowerCase();
    const head=make('div',undefined,'embody-head');
    head.append(make('span',inside?'SEEING AS THE '+name.toUpperCase():'WATCHING THE '+name.toUpperCase(),'embody-kicker'));
    const row=make('div',undefined,'embody-controls');
    if(inside){
      const seg=make('div',undefined,'embody-seg',{role:'group','aria-label':'Camera'});
      for(const [id,label] of [['eyes','Its eyes'],['shoulder','Over its shoulder']])seg.append(button(label,()=>embody.setView(id),'',{'aria-pressed':String(s.view===id)}));
      row.append(seg,button(`Watch the ${name} from outside`,()=>act(embody.observe(s.creature)),'embody-quiet'));
    }else row.append(button(`Become the ${name}`,()=>act(embody.become(s.creature)),'embody-primary'));
    let story=null;try{story=creatureStory(s.creature);}catch{}
    if(story){
      const p=s.progress[s.creature]??{},n=story.beats.filter(b=>beatUnlocked(b,p)).length;
      const sb=button(`Story · ${n}/${story.beats.length}`,()=>{storyOpen=!storyOpen;if(storyOpen&&fresh){beatIndex=Math.max(0,story.beats.findIndex(b=>b.id===fresh));fresh=null;}render();},'embody-story-button'+(fresh?' fresh':''),{'aria-expanded':String(storyOpen),'aria-controls':'embody-story'});
      row.append(sb);
    }
    row.append(button('Leave · Esc',()=>embody.exit(),'embody-leave'));
    bar.append(head,row);
    if(s.controls)bar.append(make('p',s.controls,'embody-hint'));
  }

  function renderStory(s){
    if(s.mode==='off'||!storyOpen)return;
    let story;try{story=creatureStory(s.creature);}catch{card.hidden=true;return;}
    const p=s.progress[s.creature]??{},beat=story.beats[Math.min(beatIndex,story.beats.length-1)];
    const open=beatUnlocked(beat,p);
    card.replaceChildren();
    card.append(make('span',`${story.title.toUpperCase()} · ${beatIndex+1} OF ${story.beats.length}`,'embody-kicker'));
    if(open){
      card.append(make('h3',beat.title),make('p',beat.text,'embody-prose'));
    }else{
      card.append(make('h3','Not yet'),make('p',beat.hint,'embody-prose'));
      const meter=make('div',undefined,'embody-meter',{role:'progressbar','aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(Math.round(beatProgress(beat,p)*100)),'aria-label':'Progress toward this moment'});
      const fill=make('span');fill.style.width=Math.round(beatProgress(beat,p)*100)+'%';meter.append(fill);card.append(meter);
    }
    const nav=make('div',undefined,'embody-story-nav');
    const prev=button('←',()=>{beatIndex=Math.max(0,beatIndex-1);render();},'',{'aria-label':'Previous moment'});prev.disabled=beatIndex===0;
    const next=button('→',()=>{beatIndex=Math.min(story.beats.length-1,beatIndex+1);render();},'',{'aria-label':'Next moment'});next.disabled=beatIndex>=story.beats.length-1;
    nav.append(prev,next,button('Close',()=>{storyOpen=false;render();},'embody-quiet'));
    card.append(nav);
    const note=make('p',`${story.note} ${open?'':''}`,'embody-note');card.append(note);
    const d=make('details',undefined,'embody-sources');d.append(make('summary','What supports this story?'));
    const ul=make('ul');
    for(const src of story.sources){const li=make('li'),a=make('a',src.label);a.href=src.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a,make('span',` · consulted ${src.retrieved}`));ul.append(li);}
    d.append(make('p',`${story.species}. ${story.simulated[0].toUpperCase()+story.simulated.slice(1)} stands in for it here.`),ul);card.append(d);
  }

  function render(){const s=embody.snapshot();last=s;renderBar(s);renderStory(s);}

  const onKey=e=>{
    if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||document.querySelector('#panel')?.open)return;
    if(embody.driving&&e.code==='Space'){e.preventDefault();embody.setJump(true);return;}
    if(!embody.active)return;
    if(e.code==='KeyV'&&embody.mode==='inside'){embody.cycleView();return;}
    if(e.code==='KeyG'){storyOpen=!storyOpen;render();return;}
  };
  const onKeyUp=e=>{if(e.code==='Space')embody.setJump(false);};
  addEventListener('keydown',onKey);addEventListener('keyup',onKeyUp);
  const sync=()=>{
    const s=embody.snapshot();
    // Re-render only when something visible changed; progress ticks every frame.
    const key=JSON.stringify([s.mode,s.creature,s.view,s.list.map(c=>[c.id,c.present,c.canBecome]),storyOpen,beatIndex,fresh,Object.values(s.progress).map(p=>Object.values(p).map(v=>Math.floor(v/(storyOpen?1:5))))]);
    if(key!==sync.key){sync.key=key;render();}
  };
  /** "Who lives here": rows for the World drawer's Life section (controls registry). */
  function mountList({container,kit,close=()=>{}}){
    const wrap=make('div',undefined,'embody-list',{id:'who-lives',role:'group','aria-label':'Who lives here'});
    wrap.append(make('span','Who lives here','ctl-label'),make('p','Simulated animals of this recreated place. Watch one from outside, or see as it does.','ctl-note'));
    const rows=new Map();
    const build=()=>{
      for(const c of embody.list()){
        if(rows.has(c.id))continue;
        const row=make('div',undefined,'embody-row');
        const watch=kit.action({label:`Watch the ${c.name.toLowerCase()}`,onClick:()=>{const r=embody.observe(c.id);if(r.ok)close();else notify(r.reason);}});
        const become=kit.action({label:`Become the ${c.name.toLowerCase()}`,onClick:()=>{const r=embody.become(c.id);if(r.ok)close();else notify(r.reason);}});
        become.element.classList.add('embody-primary');
        const status=make('small',undefined,'ctl-hint');
        row.append(status,watch.element,become.element);wrap.append(row);rows.set(c.id,{watch,become,status});
      }
    };
    container.append(wrap);build();
    return {update(){
      build();
      for(const c of embody.list()){
        const r=rows.get(c.id);if(!r)continue;
        r.watch.element.disabled=!c.present;r.become.element.disabled=!c.present||!c.canBecome;
        r.become.element.title=c.becomeBlocked??'';
        r.status.textContent=c.present?(c.activity?`${c.name}, simulated \u00b7 ${c.activity}`:`${c.name}, simulated`):`${c.name} is not out right now`;
      }
    }};
  }
  /** The encounter card's one-tap entry: "Become the robin" while that animal is the one shown. */
  function bindEncounter(btn,id){
    if(!btn)return;
    const c=id?embody.list().find(x=>x.id===id):null;
    btn.hidden=!c||!c.present||!c.canBecome;
    if(c){btn.textContent=`Become the ${c.name.toLowerCase()}`;btn.onclick=()=>{const r=embody.become(id);if(!r.ok)notify(r.reason);};}
  }
  render();
  return {
    sync,render,mountList,bindEncounter,
    unlocked(id){fresh=id;if(!storyOpen)render();},
    openStory(){storyOpen=true;render();},
    dispose(){removeEventListener('keydown',onKey);removeEventListener('keyup',onKeyUp);root.remove();document.body.classList.remove('embodied');},
  };
}
