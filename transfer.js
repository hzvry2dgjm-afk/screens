/* Portable, versioned Screens documents. No hardware settings or live state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.screensTransfer=api;})(typeof window==='undefined'?globalThis:window,()=>{
  const copy=x=>JSON.parse(JSON.stringify(x));
  const format='screens-transfer', version=1;
  const fail=m=>{throw new Error(m);};
  const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const str=x=>typeof x==='string';
  const arr=x=>Array.isArray(x);
  const id=x=>str(x)&&x.length>0&&x.length<512&&!['__proto__','constructor','prototype'].includes(x);
  const lines=x=>arr(x)&&x.every(str);
  const keys=x=>arr(x)&&x.every(str);
  const uniq=(list,label)=>{if(new Set(list.map(x=>x.id)).size!==list.length)fail('Duplicate '+label+' identifiers.');};
  function validateSongs(songs){
    if(!arr(songs)||!songs.every(s=>obj(s)&&id(s.id)&&str(s.title)&&s.title.trim()&&arr(s.sections)&&s.sections.every(g=>obj(g)&&id(g.id)&&str(g.name)&&arr(g.slides)&&g.slides.every(v=>obj(v)&&lines(v.lines)))&&(!('source' in s)||str(s.source))))fail('Invalid song or slide library.');
    uniq(songs,'library item'); for(const s of songs)uniq(s.sections,'section');
  }
  function validateSet(setlist,songs){
    if(!arr(setlist))fail('Invalid service order.'); const byId=new Map(songs.map(s=>[s.id,s]));
    for(const i of setlist){
      if(!obj(i)||!id(i.id))fail('Invalid service item.');
      if(i.type==='divider'){if(!str(i.title))fail('Invalid divider.');continue;}
      const song=byId.get(i.songId);if(!song||!keys(i.sequence)||i.sequence.some(s=>!song.sections.some(g=>g.id===s)))fail('Missing song or arrangement section.');
      for(const k of ['hiddenSlides','deletedSlides','slideOrder'])if(k in i&&!keys(i[k]))fail('Invalid slide order.');
      if('slideOverrides' in i&&(!obj(i.slideOverrides)||!Object.values(i.slideOverrides).every(lines)))fail('Invalid slide edits.');
      if('slideNotes' in i&&(!obj(i.slideNotes)||!Object.values(i.slideNotes).every(str)))fail('Invalid slide notes.');
      if('customSlides' in i){if(!arr(i.customSlides)||!i.customSlides.every(s=>obj(s)&&id(s.id)&&str(s.after)&&str(s.section)&&lines(s.lines)))fail('Invalid custom slides.');uniq(i.customSlides,'custom slide');}
    } uniq(setlist,'service item');
  }
  function validateService(s){if(!obj(s)||!id(s.id)||!str(s.name)||!s.name.trim())fail('Invalid service.');validateSongs(s.songs);validateSet(s.setlist,s.songs);}
  const wrap=(kind,payload)=>({format,version,kind,exportedAt:new Date().toISOString(),payload:copy(payload)});
  function snapshot(state,name,makeId,items=state.setlist){const used=new Set(items.map(i=>i.songId));const s={id:makeId(),name:name.trim()||'Untitled Service',savedAt:new Date().toISOString(),setlist:copy(items),songs:copy(state.songs.filter(x=>used.has(x.id)))};validateService(s);return s;}
  function service(s){validateService(s);return wrap('service',s);}
  function item(song){validateSongs([song]);return wrap('item',song);}
  function library(state,makeId){const p={songs:state.songs,services:(state.services||[]).map(s=>hydrate(s,state.songs)),current:snapshot(state,state.serviceName||'Current Service',makeId)};validateSongs(p.songs);p.services.forEach(validateService);return wrap('library',p);}
  function hydrate(s,songs){if(!obj(s)||!arr(s.setlist))fail('Invalid saved service.');const used=new Set(s.setlist.map(i=>i.songId));return {...copy(s),songs:copy(arr(s.songs)?s.songs:songs.filter(x=>used.has(x.id)))};}
  function parse(raw,makeId){
    if(!obj(raw))fail('Not a Screens file.');
    if(raw.format!==format){if(!arr(raw.songs)||!arr(raw.setlist))fail('Not a Screens file or older Worship Presenter backup.');return library(raw,makeId);}
    if(raw.version!==version)fail('Unsupported Screens file version.');
    if(raw.kind==='item')validateSongs([raw.payload]);else if(raw.kind==='service')validateService(raw.payload);else if(raw.kind==='library'){const p=raw.payload;if(!obj(p)||!arr(p.services))fail('Invalid library.');validateSongs(p.songs);p.services.forEach(validateService);validateService(p.current);}else fail('Unknown Screens file type.');return copy(raw);
  }
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  const withoutId=({id,...other})=>other;
  function merge(state,doc,makeId,{open=false}={}){
    doc=parse(doc,makeId); const next=copy(state);next.services||=[];
    const counts={items:0,services:0,conflicts:0};
    const fresh=used=>{let n;do{n=makeId();}while(used.has(n));return n;};
    function addSong(s){const hit=next.songs.find(x=>x.id===s.id);if(hit&&same(hit,s))return hit.id;
      if(hit){const identical=next.songs.find(x=>same(withoutId(x),withoutId(s)));if(identical)return identical.id;counts.conflicts++;}
      const song=copy(s);if(hit)song.id=fresh(new Set(next.songs.map(x=>x.id)));next.songs.push(song);counts.items++;return song.id;}
    function addService(s,shouldOpen){const map=new Map(s.songs.map(x=>[x.id,addSong(x)]));const saved=copy(s);saved.setlist.forEach(i=>{if(i.type!=='divider')i.songId=map.get(i.songId);});saved.songs=s.songs.map(x=>({...copy(x),id:map.get(x.id)}));
      const existing=next.services.find(x=>x.id===saved.id);let result=saved;
      if(existing&&same(existing,saved))result=existing;
      else {if(existing){saved.id=fresh(new Set(next.services.map(x=>x.id)));counts.conflicts++;}next.services.push(saved);counts.services++;}
      if(shouldOpen){next.setlist=copy(result.setlist);next.serviceName=result.name;next.activeItem=Math.max(0,next.setlist.findIndex(i=>i.type!=='divider'));next.activeSlide=0;next.blackout=true;}
    }
    if(doc.kind==='item')addSong(doc.payload);
    if(doc.kind==='service')addService(doc.payload,open);
    if(doc.kind==='library'){doc.payload.songs.forEach(addSong);doc.payload.services.forEach(s=>addService(s,false));addService(doc.payload.current,open);}
    return {state:next,counts};
  }
  return {snapshot,service,item,library,parse,merge};
});
