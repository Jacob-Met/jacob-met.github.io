import {serializeTransfer,parseTransfer,mergeTransfer,MAX_TRANSFER_BYTES} from './transfer.mjs';
/** Local-file transfer view. The host owns persistence and its cross-window lock. */
export function mountTransferView(container,{getSession,onImport,onClose=()=>{}}){
 let disposed=false,generation=0,url=null,verified=null,previewSequence=null;
 const root=document.createElement('section');root.className='transfer-view';container.replaceChildren(root);
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(parent,text,id,fn)=>{const b=el('button',text);b.type='button';if(id)b.id=id;b.onclick=fn;parent.append(b);return b;};
 const heading=el('h2','Move a continuing place');root.append(heading,el('p','Save a local file of interpreted places and optional personal moments, or receive one in this browser. Originals are not included. Nothing is uploaded.'));
 const tabs=el('div');tabs.className='transfer-actions';root.append(tabs);
 const pane=el('div');root.append(pane);const status=el('p');status.className='transfer-status';status.setAttribute('role','status');root.append(status);
 const say=(text,state)=>{if(disposed)return;status.textContent=text;root.dataset.state=state;};
 const counts=s=>`${s?.addedPlaces?.length||0} new place(s), ${s?.addedMoments?.length||0} new personal moment(s), ${s?.skippedPlaces?.length||0} skipped place(s), ${s?.skippedMoments?.length||0} skipped personal moment(s)${s?.unselectedMoments?.length?`, ${s.unselectedMoments.length} deliberately unselected personal moment(s)`:''}${s?.replacedMoments?.length?`, ${s.replacedMoments.length} older local moment(s) intentionally replaced`:''}`;
 const clear=()=>{generation++;verified=null;previewSequence=null;if(url){URL.revokeObjectURL(url);url=null;}pane.replaceChildren();say('','idle');};
 function summary(parent,s){const title=el('h3',`${s.placeCount} place${s.placeCount===1?'':'s'} · ${s.momentCount} personal moment${s.momentCount===1?'':'s'}`);parent.append(title);const places=el('ul');for(const p of s.places)places.append(el('li',`${p.name} — revision ${p.revision}, ${p.landmarks} landmarks, ${p.historyRevisions} historical revisions, ${p.revokedSources} source removals`));parent.append(places,el('h4','Included'));const contents=el('ul');for(const text of s.contents)contents.append(el('li',text));parent.append(contents,el('h4','Excluded'));const excluded=el('ul');for(const text of s.excluded)excluded.append(el('li',text));parent.append(excluded,el('p',s.note));}
 function exportPane(){
  clear();const session=getSession(),place=session.places.find(p=>p.id===session.activePlaceId);
  const heading=el('h3');pane.append(heading);
  const scopeLabel=el('label','Places to export'),scope=el('select');
  scope.id='transfer-export-scope';scopeLabel.htmlFor=scope.id;
  const currentOption=el('option','This place'),allOption=el('option',`All saved places (${session.places.length})`);
  currentOption.value='current';allOption.value='all';scope.append(currentOption,allOption);scope.value='current';
  pane.append(scopeLabel,scope);
  const label=el('label'),labelText=el('span'),include=el('input');
  label.className='transfer-export-memories';
  include.id='transfer-export-memories';include.type='checkbox';include.checked=true;
  label.append(include,labelText);pane.append(label);
  const details=el('div');pane.append(details);let accepted=null;
  const download=button(pane,'Download derived-world file','transfer-download',()=>{
   if(disposed||!accepted||accepted.url!==url)return;
   const a=el('a');a.href=accepted.url;a.download=accepted.filename;a.click();
   say('Download started. Keep the file private if its names, notes or viewpoints are personal.','exported');
  });download.disabled=true;
  async function prepare(){
   const token=++generation,all=scope.value==='all',includeMemories=include.checked;
   const placeIds=all?session.places.map(p=>p.id):[place.id],filename=all?'wildside-all-saved-places.json':'wildside-derived-world.json';
   accepted=null;download.disabled=true;if(url){URL.revokeObjectURL(url);url=null;}
   heading.textContent=all?'Export all saved places':`Export ${place.name}`;
   labelText.textContent=all?'Include personal moments for all saved places ':'Include personal moments for this place ';
   details.replaceChildren();say('Preparing the selected contents…','loading');
   try{
    const file=await serializeTransfer(session,{placeIds,includeMemories});
    if(disposed||token!==generation)return;
    summary(details,file.summary);
    const acceptedURL=URL.createObjectURL(new Blob([file.text],{type:'application/json'}));
    url=acceptedURL;accepted={url:acceptedURL,filename};download.disabled=false;
    say(`${file.bytes.toLocaleString()} bytes. Review the contents before downloading. Source-removal records do not erase copies already exported elsewhere.`,'export-ready');
   }catch(e){if(!disposed&&token===generation)say(e.message,'error');}
  }
  scope.onchange=prepare;include.onchange=prepare;prepare();
 }
 function importPane(){clear();pane.append(el('h3','Receive a local derived-world file'));const label=el('label','Choose a derived-world file '),input=el('input');input.type='file';input.accept='.json,application/json';input.id='transfer-file';label.append(input);pane.append(label);const details=el('div'),selectionBox=el('fieldset'),conflictBox=el('div');selectionBox.id='transfer-place-selection';selectionBox.hidden=true;conflictBox.id='transfer-conflicts';pane.append(details,selectionBox);
  const replacementBox=el('fieldset');replacementBox.id='transfer-moment-replacement';replacementBox.hidden=true;
  replacementBox.append(el('legend','Optional: replace one older local personal moment'));
  replacementBox.append(el('p','A full library can receive one chosen new moment by replacing an older local moment. This permanently removes that older local moment from this browser. Use the optional backup below if you want to keep it.'));
  const olderSelect=el('select');olderSelect.id='transfer-replace-older';olderSelect.setAttribute('aria-label','Older local moment to replace');replacementBox.append(olderSelect);
  const confirmLabel=el('label',' I understand the older local moment will be removed '),confirmReplacement=el('input');confirmReplacement.type='checkbox';confirmReplacement.id='transfer-replace-confirm';confirmLabel.append(confirmReplacement);replacementBox.append(confirmLabel);
  const backupBox=el('div');backupBox.className='transfer-review-backup';replacementBox.append(backupBox);
  backupBox.append(el('h4','Optional: back up every saved place'),el('p','Includes every currently saved place and personal moment, including the older moment selected above. Originals are excluded. Nothing is uploaded. Keep the file private; later source removal cannot erase exported copies.'));
  const backupStatus=el('p');backupStatus.id='transfer-backup-status';backupStatus.setAttribute('role','status');
  let backupRevision=0,backupAccepted=null;
  const ownsBackup=t=>!disposed&&t.generation===generation&&t.revision===backupRevision&&t.verified===verified&&t.sequence===previewSequence;
  const staleBackup='Saved places changed after this preview. Choose the file again to review the current state.';
  function resetBackup(message=''){
   backupRevision++;backupAccepted=null;if(url){URL.revokeObjectURL(url);url=null;}
   backupDownload.disabled=true;backupPrepare.disabled=!verified||previewSequence===null;
   backupStatus.textContent=message;
  }
  const backupPrepare=button(backupBox,'Prepare backup of all saved places','transfer-backup-prepare',async()=>{
   if(disposed||!verified||previewSequence===null||root.dataset.state==='saving')return;
   resetBackup();const ticket={generation,revision:backupRevision,verified,sequence:previewSequence};
   backupPrepare.disabled=true;backupStatus.textContent='Preparing all saved places and personal moments…';
   try{
    const current=getSession();if(current.sequence!==ticket.sequence)throw Error(staleBackup);
    const snapshot=JSON.parse(JSON.stringify(current));
    const file=await serializeTransfer(snapshot,{placeIds:snapshot.places.map(p=>p.id),includeMemories:true});
    if(!ownsBackup(ticket))return;
    if(getSession().sequence!==ticket.sequence)throw Error(staleBackup);
    url=URL.createObjectURL(new Blob([file.text],{type:'application/json'}));
    backupAccepted={...ticket,url};backupDownload.disabled=false;
    backupStatus.textContent=`Ready: ${file.summary.placeCount} saved place(s), ${file.summary.momentCount} personal moment(s), ${file.bytes.toLocaleString()} bytes. Downloading does not import or replace anything.`;
   }catch(e){
    if(ownsBackup(ticket)){backupStatus.textContent=e.message;if(getSession().sequence!==ticket.sequence)commit.disabled=true;}
   }finally{if(ownsBackup(ticket))backupPrepare.disabled=false;}
  });backupPrepare.disabled=true;
  const backupDownload=button(backupBox,'Download backup','transfer-backup-download',()=>{
   if(!backupAccepted||!ownsBackup(backupAccepted)||backupAccepted.url!==url)return;
   if(getSession().sequence!==backupAccepted.sequence){resetBackup(staleBackup);commit.disabled=true;return;}
   const a=el('a');a.href=backupAccepted.url;a.download='wildside-all-saved-places.json';a.click();
   backupStatus.textContent='Download started. Keep the file if you want to retain these original moments. Replacement still requires the existing import action.';
  });backupDownload.disabled=true;backupBox.append(backupStatus);
  pane.append(replacementBox,conflictBox);
  let placeChoices=[],momentChoices=[],momentControls=[];
  olderSelect.onchange=()=>{confirmReplacement.checked=false;preview();};confirmReplacement.onchange=preview;
  const selectedIds=()=>placeChoices.filter(c=>c.input.checked).map(c=>c.id);
  const selectedMomentIds=()=>{const selected=new Set(selectedIds());return momentChoices.filter(c=>selected.has(c.placeId)&&c.input.checked).map(c=>c.id);};
  const replacementChoice=()=>{
   if(!olderSelect.value)return {};
   const localIds=new Set(getSession().memories.map(m=>m.id));
   const fresh=selectedMomentIds().filter(id=>!localIds.has(id));
   if(fresh.length!==1)throw Error('To replace an older moment, select exactly one new incoming moment. Uncheck the other new moments first.');
   return {momentReplacement:{incomingId:fresh[0],localId:olderSelect.value}};
  };
  function choosePlaces(parsed){
   placeChoices=[];momentChoices=[];momentControls=[];selectionBox.replaceChildren();
   const legend=el('legend','Choose incoming places and personal moments');
   selectionBox.append(legend,el('p','Checked places are eligible. Expand each place to choose specific original moments. Unselected moments are not treated as policy conflicts. Source removals follow only accepted places.'));
   for(const p of parsed.data.places){
    const label=el('label'),input=el('input');input.type='checkbox';input.checked=true;input.dataset.placeId=p.id;input.onchange=preview;
    const moments=parsed.data.memories.filter(m=>m.placeId===p.id);
    label.append(input,document.createTextNode(` ${p.name} · ${moments.length} personal moment(s)`));
    selectionBox.append(label,el('br'));placeChoices.push({id:p.id,input});
    if(!moments.length)continue;
    const group=el('details');group.className='transfer-moment-group';
    group.append(el('summary',`Choose moments for ${p.name} (${moments.length})`));
    const filter=el('input');filter.type='search';filter.placeholder='Find personal moments';filter.setAttribute('aria-label',`Find personal moments in ${p.name}`);group.append(filter);momentControls.push(filter);
    const controls=el('div');controls.className='transfer-moment-actions';group.append(controls);
    const list=el('div');list.className='transfer-moment-list';group.append(list);
    const entries=[];
    for(const m of moments){
     const row=el('label'),box=el('input');box.type='checkbox';box.checked=true;box.dataset.momentId=m.id;box.onchange=preview;
     row.append(box,document.createTextNode(' '+m.label));list.append(row,el('br'));
     const entry={id:m.id,placeId:p.id,input:box,row,label:m.label.toLowerCase()};entries.push(entry);momentChoices.push(entry);
    }
    filter.oninput=()=>{const needle=filter.value.trim().toLowerCase();for(const entry of entries){entry.row.hidden=!entry.label.includes(needle);const after=entry.row.nextElementSibling;if(after?.tagName==='BR')after.hidden=entry.row.hidden;}};
    for(const [title,checked] of [['Select shown',true],['Clear shown',false]])momentControls.push(button(controls,title,null,()=>{for(const entry of entries)if(!entry.row.hidden)entry.input.checked=checked;preview();}));
    selectionBox.append(group);
   }
   selectionBox.hidden=false;
   olderSelect.replaceChildren();const keep=el('option','Keep every existing local moment');keep.value='';olderSelect.append(keep);
   const current=getSession(),names=new Map(current.places.map(p=>[p.id,p.name]));
   for(const m of current.memories){const option=el('option',`${m.label} — ${names.get(m.placeId)??'Saved place'}`);option.value=m.id;olderSelect.append(option);}
   olderSelect.value='';confirmReplacement.checked=false;
   replacementBox.hidden=!current.memories.length||!parsed.data.memories.length;
  }
  const choiceLabel=el('label','Conflicting places or revoked sources '),choice=el('select');choice.id='transfer-policy';for(const [value,text]of [['reject','Refuse the whole import if identities differ'],['skip','Keep local versions and skip conflicting incoming items']]){const o=el('option',text);o.value=value;choice.append(o);}choiceLabel.append(choice);pane.append(choiceLabel);
  const commit=button(pane,'Import reviewed contents','transfer-commit',async()=>{if(!verified||previewSequence===null||!selectedIds().length||(olderSelect.value&&!confirmReplacement.checked))return;let replacement;try{replacement=replacementChoice();}catch(e){say(e.message,'error');return;}const token=generation,payload=verified,sequence=previewSequence,policy=choice.value,placeIds=selectedIds(),momentIds=selectedMomentIds();resetBackup();backupPrepare.disabled=true;commit.disabled=true;input.disabled=true;choice.disabled=true;olderSelect.disabled=true;confirmReplacement.disabled=true;for(const c of [...placeChoices,...momentChoices])c.input.disabled=true;for(const control of momentControls)control.disabled=true;say('Saving the reviewed contents…','saving');try{const result=await onImport(payload,{expectedSequence:sequence,conflicts:policy,activateImported:true,placeIds,momentIds,...replacement});if(disposed||token!==generation)return;if(!result.ok)throw Error(result.error||'The import was refused. Local places are unchanged. Review the conflicts again.');verified=null;previewSequence=null;resetBackup();const skipped=result.summary?.skippedPlaces?.length||0;say(result.changed?`Import saved. ${counts(result.summary)}. ${skipped?`${skipped} conflicting place(s) were skipped; their source removals were not applied.`:'No existing different place was overwritten.'}`:`No saved data changed. ${counts(result.summary)}. These contents are already present, or all conflicting contents were skipped.`,'imported');}catch(e){if(token===generation){say(e.message,'error');commit.disabled=false;}}finally{if(!disposed&&token===generation){backupPrepare.disabled=!verified||previewSequence===null;input.disabled=false;choice.disabled=false;olderSelect.disabled=false;confirmReplacement.disabled=false;for(const c of [...placeChoices,...momentChoices])c.input.disabled=false;for(const control of momentControls)control.disabled=false;}}});commit.disabled=true;
  function preview(){if(root.dataset.state==='saving')return;resetBackup();conflictBox.replaceChildren();if(!verified)return;if(!selectedIds().length){commit.disabled=true;say('Choose at least one incoming place before importing. Nothing was saved.','preview');return;}try{const current=getSession();if(current.sequence!==previewSequence)throw Error('Saved places changed after this preview. Choose the file again to review the current state.');const plan=mergeTransfer(current,verified,{conflicts:choice.value,activateImported:true,placeIds:selectedIds(),momentIds:selectedMomentIds(),...replacementChoice()});for(const conflict of plan.conflicts){const sourceRefusal=conflict.kind==='place'&&conflict.reason.includes('source previously removed locally');const details=sourceRefusal?` ${conflict.localRevokedSources.length} previously removed source(s) remain blocked on this device. Skipping this place does not restore them.`:conflict.kind==='place'?` Local source removals: ${conflict.localRevokedSources.length}. Incoming source removals: ${conflict.incomingRevokedSources.length}. Incoming removals are not applied when this place is skipped.`:'';const p=el('p',`${conflict.name||conflict.id}: ${conflict.reason}${details}`);p.className='transfer-conflict';conflictBox.append(p);}if(plan.ok){const p=el('p',`Under this choice: ${counts(plan.summary)}.`);p.id='transfer-import-plan';conflictBox.prepend(p);for(const r of plan.summary.replacedMoments??[]){const older=current.memories.find(m=>m.id===r.localId),fresh=verified.data.memories.find(m=>m.id===r.incomingId);conflictBox.append(el('p',`Replacement preview: remove local “${older?.label??r.localId}” and keep incoming “${fresh?.label??r.incomingId}”. This local removal cannot be undone without a backup.`));}}commit.disabled=!plan.ok||(!!olderSelect.value&&!confirmReplacement.checked);say(plan.ok?(olderSelect.value&&!confirmReplacement.checked?'Confirm the deliberate replacement before importing.':plan.changed?'Verified. Review the contents, then import them.':'Verified. Nothing new will be added with this choice.'):'Identities conflict. Refuse this import, or explicitly choose to skip conflicting incoming items.','preview');}catch(e){commit.disabled=true;say(e.message,'error');}}
  choice.onchange=preview;
  input.onchange=async()=>{const token=++generation;verified=null;previewSequence=null;resetBackup();commit.disabled=true;details.replaceChildren();conflictBox.replaceChildren();selectionBox.hidden=true;selectionBox.replaceChildren();replacementBox.hidden=true;olderSelect.replaceChildren();confirmReplacement.checked=false;placeChoices=[];momentChoices=[];momentControls=[];say('Checking the selected file…','loading');const file=input.files?.[0];if(!file){say('No file selected.','idle');return;}try{if(file.size>MAX_TRANSFER_BYTES)throw Error('The file exceeds the 16 MB local-file limit.');const parsed=await parseTransfer(await file.text());if(disposed||token!==generation)return;verified=parsed;previewSequence=getSession().sequence;summary(details,parsed.summary);choosePlaces(parsed);preview();}catch(e){if(token===generation)say(e.message,'error');}};
 }
 button(tabs,'Export places','transfer-export',exportPane);button(tabs,'Import a file','transfer-import',importPane);button(root,'Back to the place',null,onClose);say('Choose export or import to inspect the contents.','idle');
 return {dispose(){if(disposed)return;disposed=true;generation++;verified=null;if(url)URL.revokeObjectURL(url);root.remove();}};
}
