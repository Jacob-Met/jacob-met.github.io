import {ecologyDiscovery} from './ecology-discovery.mjs';

const make=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
const control=(text,action,cls='')=>{const b=make('button',text,cls);b.type='button';b.addEventListener('click',action);return b;};
/** Renders optional, self-contained discovery. Close returns to the same world pose. */
export function mountEcologyDiscovery(root,{encounter='robin',region=null,onClose}={}){
  if(typeof onClose!=='function')throw Error('Return-to-world callback is required');
  const model=ecologyDiscovery({encounter,region});
  const wrap=make('div',undefined,'ecology-discovery');
  wrap.append(make('span','LOOK A LITTLE CLOSER','ecology-kicker'),make('h2','Every life has a place'),make('p',model.opening,'ecology-lede'),make('p',model.localNotice,'ecology-disclaimer'));
  const tabs=make('div',undefined,'ecology-choices'),story=make('section',undefined,'ecology-story');
  tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Choose an ecological story');
  story.setAttribute('role','region');story.setAttribute('aria-label','Ecological story');story.setAttribute('aria-live','polite');
  const buttons=[];let selected=0,beat=0;
  const show=(restoreFocus='')=>{
    const c=model.cases[selected],part=c.story[beat];
    buttons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===selected));b.classList.toggle('chosen',i===selected);});
    story.replaceChildren();
    story.append(make('span',c.eyebrow,'ecology-kicker'),make('h3',c.title));
    story.append(make('p',part.question,'ecology-prompt'),make('h4',part.heading),make('p',part.text,'ecology-copy'));
    const steps=make('p',`Moment ${beat+1} of ${c.story.length}`,'ecology-step');
    const row=make('div',undefined,'ecology-actions');
    const previous=beat>0?control('← Previous moment',()=>{beat--;show('previous');}):null;
    if(previous)row.append(previous);
    const forward=beat<c.story.length-1
      ?control('Keep following →',()=>{beat++;show('forward');},'ecology-next')
      :control('Return to the living place ↗',onClose,'ecology-next');
    row.append(forward);
    story.append(steps,row);
    const evidence=make('details',undefined,'ecology-evidence');
    const sum=make('summary','What supports this story?');evidence.append(sum);
    evidence.append(make('p',c.identity),make('p',`Context: ${c.region}`),make('p',`Arrival: ${c.arrival}`));
    evidence.append(make('p',`Range status: ${c.nativeStatus}. Ecological effect: ${c.impactStatus}. ${c.kind==='illustrative'?'This comparison is hypothetical, not a wildlife record.':'This is a region-scoped account, not an observed individual.'}`));
    const list=make('ul');for(const s of c.sources){
      const li=make('li'),a=make('a',s.label);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';
      li.append(a,make('span',` · ${s.language}, consulted ${s.retrieved}`));list.append(li);
    }
    evidence.append(list);story.append(evidence);
    // The clicked step control was replaced; restore focus to a visible successor.
    // Otherwise keyboard users fall back to the document when advancing the story.
    if(restoreFocus)(restoreFocus==='previous'&&previous?previous:forward).focus({preventScroll:true});
  };
  model.cases.forEach((c,i)=>{
    const b=control(c.title,()=>{selected=i;beat=0;show();});tabs.append(b);buttons.push(b);
  });
  wrap.append(tabs,story,control('Back to exploring ↗',onClose,'ecology-return'));
  root.append(wrap);show();
  return {dispose(){wrap.remove();},get selection(){return model.cases[selected].id;},get moment(){return beat;}};
}
