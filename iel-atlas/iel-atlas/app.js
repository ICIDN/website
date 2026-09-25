/* Indian Electronic Literature Atlas: application script.
   Data: atlas-data.js (window.IEL_DATA), india-states.js (window.IEL_STATES).
   Settings: config.js (window.IEL_CONFIG). */
(function(){
"use strict";
const D = window.IEL_DATA;
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
function h(tag, attrs, ...kids){
  const el=document.createElement(tag);
  if(attrs) for(const [k,v] of Object.entries(attrs)){
    if(v==null||v===false) continue;
    if(k==='class') el.className=v; else if(k==='text') el.textContent=v;
    else if(k.startsWith('on')) el.addEventListener(k.slice(2),v); else el.setAttribute(k,v===true?'':v);
  }
  for(const c of kids.flat()){ if(c==null||c===false) continue; el.append(c.nodeType?c:document.createTextNode(String(c))); }
  return el;
}
const COLL_LABEL={IEA1:'Indian E-Lit Anthology, Vol. I',IEA2:'Indian E-Lit Anthology, Vol. 2',DRAFTCTL:'dra.ft: Collaborative Text Lab',DRAFTEEL:'dra.ft: E-Lit list',NMWP:'New Media Writing Prize, India',SCH:'Discussed in scholarship'};
D.works.forEach(w=>{w.collName=COLL_LABEL[w.coll]||w.coll; w.hay=[w.title,w.author,w.desc,w.medium,w.region,w.lang,w.tags.join(' ')].join(' ').toLowerCase();});
D.scholarship.forEach(r=>{r.hay=[r.title,r.authors,r.abstract,r.container,r.keywords.join(' '),r.works].join(' ').toLowerCase();});
const SCH_BY_ID=Object.fromEntries(D.scholarship.map(r=>[r.id,r]));
const WORK_BY_ID=Object.fromEntries(D.works.map(w=>[w.id,w]));
const safeUrl=u=>{try{const x=new URL(u.trim());return /^https?:$/.test(x.protocol)?x.href:null}catch(e){return null}};

/* ---------- router ---------- */
const views=$$('.view');
function route(){
  const name=(location.hash.slice(1).split('?')[0])||'atlas';
  const v=views.find(v=>v.dataset.view===name)||views[0];
  views.forEach(x=>x.classList.toggle('active',x===v));
  $$('.nav a').forEach(a=>{ if(a.getAttribute('href')==='#'+v.dataset.view) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded','false');
  if(v.dataset.view==='timeline') drawTimeline();
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
$('#menuBtn').addEventListener('click',e=>{const o=$('#nav').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',o)});
$('#themeBtn').addEventListener('click',()=>{
  const r=document.documentElement; const dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme=dark?'light':'dark'; try{localStorage.setItem('iel-theme',r.dataset.theme)}catch(e){}
});
try{const t=localStorage.getItem('iel-theme'); if(t) document.documentElement.dataset.theme=t;}catch(e){}

/* ---------- kinetic multi-script line ---------- */
const SCRIPTS=[
 ['electronic literature','English','Anek Latin'],['इलेक्ट्रॉनिक साहित्य','Hindi','Anek Devanagari'],['மின்னிலக்கியம்','Tamil','Anek Tamil'],
 ['ইলেকট্রনিক সাহিত্য','Bengali','Anek Bangla'],['ഇലക്ട്രോണിക് സാഹിത്യം','Malayalam','Anek Malayalam'],['ઇલેક્ટ્રોનિક સાહિત્ય','Gujarati','Anek Gujarati'],
 ['ఎలక్ట్రానిక్ సాహిత్యం','Telugu','Anek Telugu'],['ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಾಹಿತ್ಯ','Kannada','Anek Kannada'],['الیکٹرانک ادب','Urdu','Noto Nastaliq Urdu']];
const kin=$('#kinetic');
SCRIPTS.forEach(([t,l,f],i)=>kin.append(h('span',{lang:{English:'en',Hindi:'hi',Tamil:'ta',Bengali:'bn',Malayalam:'ml',Gujarati:'gu',Telugu:'te',Kannada:'kn',Urdu:'ur'}[l],dir:l==='Urdu'?'rtl':null,style:`font-family:'${f}',var(--sans)`,text:t})));
let ki=0; const spans=$$('span',kin);
function showK(i){spans.forEach((s,j)=>s.classList.toggle('on',i===j)); $('#kineticLang').textContent=SCRIPTS[i][1];}
showK(0);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let kTimer=null; function startK(){ if(!reduce&&!kTimer) kTimer=setInterval(()=>{ki=(ki+1)%spans.length;showK(ki)},2600);} function stopK(){clearInterval(kTimer);kTimer=null}
startK(); kin.addEventListener('mouseenter',stopK); kin.addEventListener('mouseleave',startK);
document.addEventListener('visibilitychange',()=>document.hidden?stopK():startK());

/* ---------- counts ---------- */
const coreWorks=D.works.filter(w=>!w.ref&&!w.isPlatform);
const langs=new Set(D.works.flatMap(w=>w.lang.split(/[\/,]/).map(s=>s.trim())).filter(l=>l&&!/not recorded|multiple/i.test(l)));
const placeStates=new Set([...D.works.flatMap(w=>w.states),...D.scholarship.flatMap(r=>r.states)]);
[[coreWorks.length,'works','#works'],[D.scholarship.length,'scholarly records','#scholarship'],[langs.size,'languages recorded','#works'],[placeStates.size,'states on the map','#atlas']]
 .forEach(([n,l,href])=>$('#counts').append(h('a',{href},h('b',{text:n}),h('small',{text:l}))));

/* ---------- map (Leaflet, live tiles) ---------- */
const NS='http://www.w3.org/2000/svg';
const CFG=window.IEL_CONFIG||{};
const STATES=window.IEL_STATES;
const BB={lonmin:68.186,lonmax:97.401,latmin:6.757,latmax:37.078};
let layer='works', selected=null, base=CFG.defaultBase||'map', mode=CFG.defaultMode||'clusters', mapQuery='';
const byState={works:{},scholarship:{}};
D.works.forEach(w=>w.states.forEach(s=>(byState.works[s]=byState.works[s]||[]).push(w)));
D.scholarship.forEach(r=>r.states.forEach(s=>(byState.scholarship[s]=byState.scholarship[s]||[]).push(r)));
function cnt(name,l=layer){return (byState[l][name]||[]).length}

const indiaBounds=L.latLngBounds([[BB.latmin,BB.lonmin],[BB.latmax,BB.lonmax]]);
const map=L.map('map',{zoomSnap:0.25,minZoom:3,maxZoom:18,scrollWheelZoom:false,zoomControl:false,attributionControl:true});
L.control.zoom({position:'topright'}).addTo(map);
map.setView([22.5,82.8],4.5);
function fitIndia(){ map.invalidateSize(); if(!selected) map.fitBounds(indiaBounds,{padding:[10,10]}); }
// Wheel-zoom only after the reader engages with the map, so page scrolling is never hijacked.
map.on('click focus',()=>map.scrollWheelZoom.enable());
map.getContainer().addEventListener('mouseleave',()=>map.scrollWheelZoom.disable());

map.createPane('labels'); map.getPane('labels').style.zIndex=450; map.getPane('labels').style.pointerEvents='none';

const bases={
  sat:L.tileLayer(CFG.satelliteTiles||'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {maxZoom:19,attribution:CFG.satelliteAttribution||'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'}),
  map:CFG.mapTilerKey
      ? L.tileLayer(`https://api.maptiler.com/maps/${CFG.mapTilerStyle||'streets-v2'}/{z}/{x}/{y}.png?key=${CFG.mapTilerKey}`,
          {maxZoom:19,tileSize:512,zoomOffset:-1,attribution:'&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'})
      : L.tileLayer(CFG.mapTiles||'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          {maxZoom:19,attribution:'Map &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community'}),
  offline:L.imageOverlay('india-satellite-offline.jpg',indiaBounds,
      {attribution:'NASA Blue Marble &amp; shaded relief (public domain)'})
};
const labels=L.tileLayer(CFG.labelTiles||'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  {maxZoom:19,pane:'labels',attribution:'Labels &copy; Esri'});

// Fall back to the built-in NASA image if live satellite tiles cannot be reached.
let satLoaded=false, satErrors=0;
bases.sat.on('tileload',()=>{satLoaded=true});
let mapLoaded=false, mapErrors=0; bases.map.on('tileload',()=>{mapLoaded=true});
bases.map.on('tileerror',()=>{ mapErrors++; if(!mapLoaded&&mapErrors>=4&&base==='map'){ setBase('offline'); showNote('The live map could not load, so the built-in NASA image is shown.'); } });
bases.sat.on('tileerror',()=>{ satErrors++; if(!satLoaded&&satErrors>=4&&base==='sat'){ setBase('offline'); showNote('Live satellite imagery could not load, so the built-in NASA image is shown.'); } });
function showNote(msg){ const n=$('#mapNote'); if(n){ n.textContent=msg; n.hidden=false; } }

function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function colourFor(n,l){ if(!n) return null; const k=l==='works'?'w':'s';
  const max=Math.max(...Object.values(byState[l]).map(a=>a.length)); const t=n/max;
  return cssVar(`--${k}${t>.75?4:t>.45?3:t>.2?2:1}`); }
function styleFor(f){
  const n=cnt(f.properties.name), c=colourFor(n,layer), sel=f.properties.name===selected;
  const onImage=base!=='map';
  const line = sel ? (onImage?'#ffffff':'#3d0a1a') : (onImage?'rgba(255,255,255,.8)':'rgba(61,10,26,.45)');
  if(mode==='clusters') return { color: line, weight: sel?3:(onImage?1:0.8), fillColor:'#3d0a1a', fillOpacity: sel?.08:0 };
  return { color: line, weight: sel?3:1, fillColor: c||'#ffffff', fillOpacity: c ? (onImage?.6:.7) : (onImage?.03:.08) };
}
const geo=L.geoJSON(STATES,{
  style:styleFor,
  onEachFeature:(f,lyr)=>{
    lyr.bindTooltip(()=>`<strong>${f.properties.name}</strong><br>${cnt(f.properties.name,'works')} works, ${cnt(f.properties.name,'scholarship')} scholarship`,{sticky:true,direction:'top'});
    lyr.on({ click:()=>openState(f.properties.name),
      mouseover:e=>e.target.setStyle({weight:2.5,color:base==='map'?'#3d0a1a':'#fff'}),
      mouseout:e=>geo.resetStyle(e.target) });
  }
}).addTo(map);
const layerByName={}; geo.eachLayer(l=>layerByName[l.feature.properties.name]=l);

/* Clustered markers: each work sits in its recorded state; each scholarly record at its authors' institutions. */
const INST=[
 ['Shanmugapriya',23.8143,86.4412,'IIT (ISM) Dhanbad'],['Desai',23.8143,86.4412,'IIT (ISM) Dhanbad'],['Bhimjyani',23.8143,86.4412,'IIT (ISM) Dhanbad'],
 ['Roy, Samya',17.5536,78.1720,'GITAM, Hyderabad'],['Kavitha',22.5204,75.9207,'IIT Indore'],['Menon, Nirmala',22.5204,75.9207,'IIT Indore'],
 ['Joseph, Justy',22.5204,75.9207,'IIT Indore'],['Mukherjee',22.5752,88.3631,'Presidency University, Kolkata'],
 ['Bhatt',21.7524,72.1340,'MK Bhavnagar University'],['Alagiya',21.7524,72.1340,'MK Bhavnagar University'],['Barad',21.7524,72.1340,'MK Bhavnagar University'],
 ['Nagpal',28.6889,77.2100,'University of Delhi'],['Salim',12.9916,80.2336,'IIT Madras'],['Shahid',27.9135,78.0782,'Aligarh Muslim University'],
 ['Fernandez',29.8649,77.8966,'IIT Roorkee'],['Bhuyan',null,null,'Assam'],['Ramya',null,null,'Tamil Nadu'],['Roy, Gitanjali',null,null,'Tripura'],
 ['Ram Prakash',null,null,'Delhi'],['Chauhan',null,null,'Delhi']];
const CENTROID=Object.fromEntries(STATES.features.map(f=>[f.properties.name,[f.properties.lat,f.properties.lon]]));
function spread(base,k){ if(!k) return base; const a=k*2.39996, r=0.22*Math.sqrt(k); return [base[0]+r*Math.sin(a), base[1]+r*Math.cos(a)]; }
function matchesQuery(item){ if(!mapQuery) return true; return mapQuery.split(/\s+/).every(q=>item.hay.includes(q)); }
function mapPoints(l){
  const pts=[], used={};
  if(l==='works'){
    D.works.filter(w=>!w.ref&&!w.isPlatform&&matchesQuery(w)).forEach(w=>w.states.forEach(s=>{ const c=CENTROID[s]; if(!c) return;
      const k=used[s]=(used[s]||0)+1; pts.push({item:w,kind:'w',ll:spread(c,k-1),place:s}); }));
  } else {
    D.scholarship.filter(matchesQuery).forEach(r=>{ const seen=new Set();
      INST.forEach(([key,lat,lon,label])=>{ if(!r.authors.includes(key)||seen.has(label)) return; seen.add(label);
        const c=lat!=null?[lat,lon]:CENTROID[label]; if(!c) return; const k=used[label]=(used[label]||0)+1;
        pts.push({item:r,kind:'s',ll:spread(c,k-1),place:label}); }); });
  }
  return pts;
}
const clusters=L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:55,chunkedLoading:true});
function popupFor(p){
  const it=p.item, isW=p.kind==='w';
  return h('div',{class:'pop'},
    h('div',{class:'pop-kind',text:isW?`Work, ${p.place}`:`Scholarship, ${p.place}`}),
    h('strong',{text:it.title}), h('div',{class:'pop-by',text:isW?it.author:it.authors}),
    h('div',{class:'pop-meta',text:isW?[it.family,it.date].filter(Boolean).join(', '):[it.type,it.year].join(', ')}),
    h('button',{class:'btn',type:'button',onclick:()=>{ map.closePopup(); isW?openWork(it):openSch(it); }},'Open record'));
}
function paintClusters(){
  clusters.clearLayers();
  const pts=mapPoints(layer);
  clusters.addLayers(pts.map(p=>L.marker(p.ll,{title:p.item.title,
    icon:L.divIcon({className:'pt pt-'+p.kind,iconSize:[16,16]})}).bindPopup(()=>popupFor(p),{maxWidth:280})));
  const n=new Set(pts.map(p=>p.item.id)).size;
  const noun=layer==='works'?(n===1?'work':'works'):(n===1?'scholarly record':'scholarly records');
  $('#mapCount').textContent = mapQuery ? `${n} ${noun} on the map match “${mapQuery}”.` : `${n} ${noun} shown on the map.`;
}
const bubbles=L.layerGroup().addTo(map);
function paintBubbles(){
  bubbles.clearLayers(); if(mode!=='states') return;
  STATES.features.forEach(f=>{ const n=cnt(f.properties.name); if(!n) return;
    L.marker([f.properties.lat,f.properties.lon],{interactive:false,keyboard:false,
      icon:L.divIcon({className:'bubble',html:`<span>${n}</span>`,iconSize:[28,28]})}).addTo(bubbles); });
}

function setBase(b){
  base=b; Object.entries(bases).forEach(([k,l])=>{ if(k===b) l.addTo(map); else map.removeLayer(l); });
  (b==='sat'&&$('#labelsToggle').checked) ? labels.addTo(map) : map.removeLayer(labels);
  $('#labelsToggle').disabled=b!=='sat';
  $('#labelsToggle').closest('label').hidden=b!=='sat';
  $$('[data-base]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.base===b));
  paint();
}
$$('[data-base]').forEach(x=>x.addEventListener('click',()=>setBase(x.dataset.base)));
$('#labelsToggle').addEventListener('change',()=>setBase(base));

function paint(){
  geo.setStyle(styleFor); paintBubbles();
  if(mode==='clusters'){ if(!map.hasLayer(clusters)) clusters.addTo(map); paintClusters();
    $('#legend').replaceChildren('Clusters:',h('i',{class:'cl cl-s'}),'fewer',h('i',{class:'cl cl-m'}),h('i',{class:'cl cl-l'}),'more');
  } else { map.removeLayer(clusters);
    const k=layer==='works'?'w':'s';
    $('#legend').replaceChildren('Fewer',...[1,2,3,4].map(i=>h('i',{style:`background:var(--${k}${i})`})),'More');
    $('#mapCount').textContent=''; }
  const unplacedW=D.works.filter(w=>!w.states.length&&!w.ref&&!w.isPlatform);
  const dias=D.works.filter(w=>w.diaspora.length), intl=D.works.filter(w=>w.ref), abroad=D.scholarship.filter(r=>!r.states.length);
  const b=$('#beyond'); b.replaceChildren();
  if(layer==='works'){
    b.append(chip(unplacedW.length,'works with no place recorded',()=>openList('Place not recorded','Works',unplacedW)));
    b.append(chip(dias.length,'with diaspora links',()=>openList('Diaspora links','Works',dias)));
    b.append(chip(intl.length,'non-Indian reference items',()=>openList('Reference items outside India','Works',intl)));
  } else b.append(chip(abroad.length,'records by authors outside India or unplaced',()=>openList('Outside India or unplaced','Scholarship',abroad)));
  if(selected) openState(selected,true);
}
function chip(n,label,fn){return h('button',{class:'chip',type:'button',onclick:fn},h('b',{text:n}),' '+label)}
$$('[data-layer]').forEach(b=>b.addEventListener('click',()=>{layer=b.dataset.layer;$$('[data-layer]').forEach(x=>x.setAttribute('aria-pressed',x===b));paint();}));
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;$$('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',x===b));paint();}));
$$('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.mode===mode));

// Search bar under the map: filters the markers as you type; the button opens the full results list.
let mqTimer=null;
$('#mapSearch').addEventListener('input',e=>{ clearTimeout(mqTimer); mqTimer=setTimeout(()=>{ mapQuery=e.target.value.trim().toLowerCase();
  if(mode!=='clusters'){ mode='clusters'; $$('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.mode===mode)); }
  paint(); },180); });
$('#mapSearchForm').addEventListener('submit',e=>{ e.preventDefault(); const q=$('#mapSearch').value.trim();
  if(layer==='works'){ $('#wq').value=q; renderWorks(); location.hash='works'; }
  else { $('#sq').value=q; renderSch(); location.hash='scholarship'; } });

// Keyboard and screen-reader route into the map.
const jump=$('#stateJump');
jump.replaceChildren(h('option',{value:'',text:'Jump to a state'}),...STATES.features.map(f=>f.properties.name).sort().map(n=>h('option',{value:n,text:`${n} (${cnt(n,'works')} works, ${cnt(n,'scholarship')} scholarship)`})));
jump.addEventListener('change',()=>{ if(jump.value) openState(jump.value); });

function liveMapUrl(name){ const f=STATES.features.find(x=>x.properties.name===name);
  return `https://www.google.com/maps/@${f.properties.lat},${f.properties.lon},7z/data=!3m1!1e3`; }

function openState(name,keep){
  selected=name; geo.setStyle(styleFor);
  const lyr=layerByName[name]; if(lyr&&!keep) map.flyToBounds(lyr.getBounds(),{padding:[30,30],maxZoom:7,duration:reduce?0:0.8});
  const ws=byState.works[name]||[], ss=byState.scholarship[name]||[];
  const P=$('#statePanel'); P.replaceChildren(
    h('button',{class:'back',type:'button',onclick:closeState},'Back to the overview'),
    h('h2',{text:name}),
    h('p',{style:'color:var(--muted);margin:0'},`${ws.length} ${ws.length===1?'work':'works'} and ${ss.length} scholarly ${ss.length===1?'record':'records'}`),
    h('p',{style:'margin:8px 0 0;font-size:15px'},h('a',{href:liveMapUrl(name),target:'_blank',rel:'noopener noreferrer'},'Open '+name+' in Google Maps satellite view')),
    h('h3',{text:'Works'}), ws.length?miniList(ws,'w'):h('p',{class:'empty'},'No works recorded here yet. ',h('a',{href:'#submit'},'Submit a work from this state'),'.'),
    h('h3',{text:'Scholarship'}), ss.length?miniList(ss,'s'):h('p',{class:'empty',text:'No scholarship from institutions in this state yet.'}));
  $('#overview').hidden=true; P.hidden=false; jump.value=name;
  if(!keep){ P.querySelector('.back').focus({preventScroll:true});
    if(matchMedia('(max-width:900px)').matches) P.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); }
}
function closeState(){ selected=null; jump.value=''; geo.setStyle(styleFor); $('#statePanel').hidden=true; $('#overview').hidden=false;
  map.flyToBounds(indiaBounds,{padding:[10,10],duration:reduce?0:0.8}); }
function miniList(items,kind){return h('ul',{class:'rows mini'},items.map(x=>h('li',null,kind==='w'?workRow(x):schRow(x))))}
function openList(title,kind,items){
  $('#dlgBody').replaceChildren(closeBtn(),h('div',{class:'kind',text:kind}),h('h2',{id:'dlgTitle',text:title}),
    h('p',{class:'by',text:`${items.length} ${items.length===1?'record':'records'}`}),
    h('ul',{class:'rows mini'},items.map(x=>h('li',null,kind==='Works'?workRow(x):schRow(x)))));
  showDlg();
}
// Leaflet measures its container on load; re-measure when the Atlas view becomes visible again.
window.addEventListener('hashchange',()=>setTimeout(fitIndia,60));
new MutationObserver(()=>paint()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
setBase(base);

/* ---------- rows ---------- */
function workRow(w){
  return h('button',{class:'row',type:'button',onclick:()=>openWork(w)},
    h('span',{class:'t',text:w.title}), h('span',{class:'a',text:w.author}), h('span',{class:'y',text:w.date}),
    h('span',{class:'tags'},h('span',{class:'tag w',text:w.family}),h('span',{class:'tag',text:w.collName}),
      w.lang!=='Not recorded'?h('span',{class:'tag',text:w.lang}):null, w.ref?h('span',{class:'tag flag',text:'Reference item'}):null, w.isPlatform?h('span',{class:'tag flag',text:'Platform'}):null));
}
function schRow(r){
  return h('button',{class:'row',type:'button',onclick:()=>openSch(r)},
    h('span',{class:'t',text:r.title}), h('span',{class:'a',text:r.authors}), h('span',{class:'y',text:r.year}),
    h('span',{class:'tags'},h('span',{class:'tag s',text:r.type}),r.container?h('span',{class:'tag',text:r.container.length>60?r.container.slice(0,58)+'…':r.container}):null,
      r.status!=='Verified'?h('span',{class:'tag flag',text:'Flagged for checking'}):null));
}
$('#latest').append(...[...D.works].filter(w=>!w.ref&&!w.isPlatform).sort((a,b)=>(b.year||0)-(a.year||0)||a.id.localeCompare(b.id)).slice(0,6).map(w=>h('li',null,workRow(w))));

/* ---------- dialog ---------- */
const dlg=$('#dlg'); let lastFocus=null;
function closeBtn(){return h('button',{class:'x',type:'button','aria-label':'Close',onclick:()=>dlg.close()},'×')}
function showDlg(){ if(!dlg.open){lastFocus=document.activeElement; dlg.showModal();} $('#dlgBody').scrollTop=0; $('.x',dlg).focus(); }
dlg.addEventListener('close',()=>{ if(lastFocus&&document.contains(lastFocus)) lastFocus.focus(); });
dlg.addEventListener('click',e=>{ if(e.target===dlg) dlg.close(); });
function dl(pairs){return h('dl',null,pairs.filter(p=>p[1]&&p[1]!=='').flatMap(([k,v])=>[h('dt',{text:k}),h('dd',null,v)]))}
function link(u,label){const s=safeUrl(u);return s?h('a',{href:s,target:'_blank',rel:'noopener noreferrer',text:label||u.trim()}):u}
function openWork(w){
  const cited=w.cited.map(id=>SCH_BY_ID[id]).filter(Boolean);
  $('#dlgBody').replaceChildren(closeBtn(),
    h('div',{class:'kind',text:`Work, ${w.collName}`}), h('h2',{id:'dlgTitle',text:w.title}), h('p',{class:'by',text:w.author}),
    w.desc?h('p',{text:w.desc}):h('p',{class:'empty',text:'No description recorded yet.'}),
    dl([['Form',w.medium],['Date',w.date],['Language',w.lang],['Script',w.script],['Region',w.region],['Publisher',w.publisher],['Platform type',w.platformCat],['Licence',w.license],['Tags',w.tags.join(', ')],['Link',w.url?link(w.url,'Open the work'):''],['Record',w.id],['Entry by',w.entry]]),
    cited.length?h('div',null,h('h3',{style:'font-size:16px;font-weight:600;color:var(--muted);margin:10px 0 6px',text:'Discussed in'}),h('ul',{class:'rows mini'},cited.map(r=>h('li',null,schRow(r))))):null);
  showDlg();
}
function openSch(r){
  const linked=D.works.filter(w=>w.cited.includes(r.id));
  const cite=[r.container,r.vol&&('vol. '+r.vol),r.issue&&('no. '+r.issue),r.pages&&('pp. '+r.pages)].filter(Boolean).join(', ');
  $('#dlgBody').replaceChildren(closeBtn(),
    h('div',{class:'kind',text:`${r.type}, ${r.year}`}), h('h2',{id:'dlgTitle',text:r.title}), h('p',{class:'by',text:r.authors}),
    h('p',{text:r.abstract}),
    dl([['Published in',cite],['Date',r.date],['Publisher',r.publisher],['DOI',r.doi?link('https://doi.org/'+r.doi,r.doi):''],['Link',!r.doi&&r.url?link(r.url,'Open the source'):''],['Scope',r.scope],['Keywords',r.keywords.join(', ')],['Works discussed',r.works],['Access',r.access],['Record status',r.status],['Record',r.id]]),
    linked.length?h('div',null,h('h3',{style:'font-size:16px;font-weight:600;color:var(--muted);margin:10px 0 6px',text:'Works in the atlas'}),h('ul',{class:'rows mini'},linked.map(w=>h('li',null,workRow(w))))):null);
  showDlg();
}

/* ---------- works list ---------- */
function fillSelect(sel,label,vals){sel.replaceChildren(h('option',{value:'',text:label}),...vals.map(v=>h('option',{value:v,text:v})));}
fillSelect($('#wcoll'),'All collections',[...new Set(D.works.map(w=>w.collName))]);
fillSelect($('#wfam'),'All forms',[...new Set(D.works.map(w=>w.family))].sort());
fillSelect($('#wlang'),'All languages',[...new Set(D.works.map(w=>w.lang))].sort());
function worksFiltered(){
  const q=$('#wq').value.trim().toLowerCase(),c=$('#wcoll').value,f=$('#wfam').value,l=$('#wlang').value,ref=$('#wref').checked;
  return D.works.filter(w=>(ref||(!w.ref&&!w.isPlatform))&&(!c||w.collName===c)&&(!f||w.family===f)&&(!l||w.lang===l)&&(!q||q.split(/\s+/).every(t=>w.hay.includes(t))))
    .sort((a,b)=>(b.year||0)-(a.year||0)||a.title.localeCompare(b.title));
}
function renderWorks(){const list=worksFiltered(); $('#wcount').textContent=`${list.length} ${list.length===1?'work':'works'}`;
  $('#wlist').replaceChildren(...(list.length?list.map(w=>h('li',null,workRow(w))):[h('li',{class:'empty'},'No works match these filters. Clear the search or choose "All" in a filter.')]));}
['wq','wcoll','wfam','wlang','wref'].forEach(id=>$('#'+id).addEventListener('input',renderWorks));
renderWorks();

/* ---------- scholarship list ---------- */
fillSelect($('#sscope'),'All scopes',[...new Set(D.scholarship.map(r=>r.scope))].sort());
fillSelect($('#stype'),'All types',[...new Set(D.scholarship.map(r=>r.type))].sort());
$('#swho').replaceChildren(h('option',{value:'',text:'All scholars'}),...D.scholars.map(s=>h('option',{value:s.key,text:s.name})));
function schFiltered(){
  const q=$('#sq').value.trim().toLowerCase(),sc=$('#sscope').value,t=$('#stype').value,who=$('#swho').value,si=$('#ssi').checked;
  return D.scholarship.filter(r=>(!sc||r.scope===sc)&&(!t||r.type===t)&&(!who||r.authors.includes(who))&&(!si||r.si)&&(!q||q.split(/\s+/).every(x=>r.hay.includes(x))));
}
function renderSch(){const list=schFiltered(); $('#scount').textContent=`${list.length} ${list.length===1?'record':'records'}`;
  $('#slist').replaceChildren(...(list.length?list.map(r=>h('li',null,schRow(r))):[h('li',{class:'empty'},'No records match these filters. Clear the search or choose "All" in a filter.')]));}
['sq','sscope','stype','swho','ssi'].forEach(id=>$('#'+id).addEventListener('input',renderSch));
renderSch();

/* ---------- scholars ---------- */
D.scholars.forEach(s=>{
  const n=D.scholarship.filter(r=>r.authors.includes(s.key)).length;
  const acts=D.activities.filter(a=>a.who.startsWith(s.key)||a.who.includes(s.key));
  $('#people').append(h('article',{class:'person'},
    h('h3',{text:s.name}), h('p',{text:`${s.aff}, ${s.state}`}), h('p',{text:s.focus}),
    s.orcid?h('p',null,link('https://orcid.org/'+s.orcid,'ORCID '+s.orcid)):null,
    h('button',{class:'btn ghost',type:'button',onclick:()=>{$('#swho').value=s.key;$('#ssi').checked=false;$('#sq').value='';$('#sscope').value='';$('#stype').value='';renderSch();location.hash='scholarship';}},`See ${n} ${n===1?'record':'records'}`),
    acts.length?h('button',{class:'btn ghost',type:'button',style:'margin-left:8px',onclick:()=>openActs(s,acts)},'Editorial and creative work'):null));
});
function openActs(s,acts){
  $('#dlgBody').replaceChildren(closeBtn(),h('div',{class:'kind',text:'Scholar'}),h('h2',{id:'dlgTitle',text:s.name}),h('p',{class:'by',text:`${s.aff}, ${s.state}`}),
    h('ul',{class:'rows mini'},acts.map(a=>h('li',{style:'padding:10px 4px'},h('strong',{text:a.type}),h('div',{text:a.desc}),h('div',{style:'color:var(--muted);font-size:14px',text:a.date})))));
  showDlg();
}

/* ---------- timeline ---------- */
let tlDrawn=false;
function drawTimeline(){
  if(tlDrawn) return; tlDrawn=true;
  const t=$('#tlsvg'); const y0=2003,y1=2027,W=1100,H=520,pad=40,mid=H/2; t.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const x=y=>pad+(y-y0)/(y1-y0)*(W-2*pad);
  const el=(n,a)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);return e};
  t.append(el('line',{x1:pad,x2:W-pad,y1:mid,y2:mid,stroke:'var(--line)','stroke-width':2}));
  for(let y=2004;y<=2026;y+=2){t.append(el('line',{x1:x(y),x2:x(y),y1:mid-5,y2:mid+5,stroke:'var(--muted)'}));const tx=el('text',{x:x(y),y:mid+22,'text-anchor':'middle'});tx.textContent=y;t.append(tx);}
  const wt=el('text',{x:pad,y:24});wt.textContent='Works (above the line)';t.append(wt);
  const st=el('text',{x:pad,y:H-10});st.textContent='Scholarship (below the line)';t.append(st);
  const stack={};
  const put=(item,kind)=>{const y=kind==='w'?item.year:item.year; if(!y) return; const key=kind+y; const k=stack[key]=(stack[key]||0)+1;
    const cy=kind==='w'?mid-18-(k-1)*14:mid+40+(k-1)*14; const g=el('g',{class:'dot',tabindex:0,role:'button','aria-label':`${kind==='w'?'Work':'Scholarship'}, ${y}: ${item.title}`});
    const c=el('circle',{cx:x(y),cy,r:6,fill:kind==='w'?'var(--w3)':'var(--s3)'}); const ti=el('title',{}); ti.textContent=`${item.title} (${y})`; g.append(ti,c);
    const open=()=>kind==='w'?openWork(item):openSch(item); g.addEventListener('click',open); g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}); t.append(g);};
  D.works.filter(w=>!w.ref&&!w.isPlatform&&w.year).sort((a,b)=>a.year-b.year).forEach(w=>put(w,'w'));
  D.scholarship.slice().sort((a,b)=>a.year-b.year).forEach(r=>put(r,'s'));
  const maxW=Math.max(0,...Object.entries(stack).filter(([k])=>k[0]==='w').map(([,v])=>v)), maxS=Math.max(0,...Object.entries(stack).filter(([k])=>k[0]==='s').map(([,v])=>v));
  const top=Math.min(0,mid-18-(maxW-1)*14-20), bottom=Math.max(H,mid+40+(maxS-1)*14+30);
  t.setAttribute('viewBox',`0 ${top} ${W} ${bottom-top}`); wt.setAttribute('y',top+18); st.setAttribute('y',bottom-8);
}

/* ---------- collections ---------- */
const COLLS=[
 ['IEA1','w','Indian Electronic Literature Anthology, Vol. I','The first multilingual anthology of Indian e-lit (IIT Indore KSHIP, 2023), edited by Nirmala Menon, Shanmugapriya T, Justy Joseph and Deborah Sutton.'],
 ['IEA2','w','Indian Electronic Literature Anthology, Vol. 2','Eight web-based works published in March 2026, from eco-narratives to campus interactive fiction.'],
 ['NMWP','w','New Media Writing Prize, India','Winners and shortlisted works of the Indian New Media Writing Prize, the category ICIDN launched with the New Media Writing Prize.'],
 ['DRAFTCTL','w','dra.ft: Collaborative Text Lab','Collaborative born-digital experiments presented around ELO 2021: kinetic poetry, web-crawled text, data visualisation and Twine.'],
 ['DRAFTEEL','w','dra.ft: E-Lit list','A community-built list of Indian interactive fiction, games, SMS novels and platform writing, kept with a few reference items from elsewhere.'],
 ['SCH','w','Discussed in scholarship','Works known mainly through the articles that analyse them.'],
];
COLLS.forEach(([k,c,t,d])=>{const n=D.works.filter(w=>w.coll===k).length;
  $('#colls').append(h('article',{class:'coll '+c},h('h3',{text:t}),h('p',{text:d}),h('button',{class:'btn ghost',type:'button',onclick:()=>{$('#wcoll').value=COLL_LABEL[k];$('#wref').checked=true;renderWorks();location.hash='works';}},`Browse ${n} ${n===1?'work':'works'}`)));});
[['New Review of Hypermedia and Multimedia 32 (2–3)','India, Digital, LiteratureS: forms and (dis)contents, guest-edited by Samya Brata Roy, Astrid Ensslin, Zahra Rizvi and Shanmugapriya T (2026).',()=>{$('#ssi').checked=true;$('#swho').value='';renderSch();}],
 ['Reviews in Digital Humanities 7 (1)','Special issue on e-lit project reviews, guest-edited by Samya Brata Roy, Reham Hosny and Leah Henrickson (January 2026).',()=>{$('#ssi').checked=false;$('#sq').value='Reviews in Digital Humanities';renderSch();}]]
 .forEach(([t,d,fn])=>$('#colls').append(h('article',{class:'coll s'},h('h3',{text:t}),h('p',{text:d}),h('button',{class:'btn ghost',type:'button',onclick:()=>{fn();location.hash='scholarship';}},'Browse the records'))));

/* ---------- submit ---------- */
fillSelect($('#subRegion'),'Choose a state or region',[...STATES.features.map(f=>f.properties.name).sort(),'Diaspora (outside India)','Not specific to one place']);
let lastEntry=null;
$('#subForm').addEventListener('submit',e=>{
  e.preventDefault(); const f=e.currentTarget; const fd=Object.fromEntries(new FormData(f).entries());
  const missing=['title','author','url'].filter(k=>!fd[k].trim());
  if(missing.length){$('#subStatus').textContent='Add the '+missing.map(m=>m==='url'?'link':m).join(', ')+' to create the entry.'; f.querySelector(`[name="${missing[0]}"]`).focus(); return;}
  if(!safeUrl(fd.url)){$('#subStatus').textContent='The link must start with http:// or https://.'; f.url.focus(); return;}
  lastEntry={internal_ref_id:'SUBMITTED-'+new Date().toISOString().slice(0,10),source_collection:'Atlas submission',author:fd.author.trim(),title:fd.title.trim(),description:fd.description.trim(),
    language:fd.language.trim(),date:fd.date.trim(),medium:fd.medium.trim(),entry_author:fd.entry_author.trim(),tags:fd.tags.trim(),url:fd.url.trim(),license:fd.license.trim(),
    script:fd.script.trim(),region:fd.region,contact:fd.contact.trim()};
  $('#subEntry').textContent=JSON.stringify(lastEntry,null,2); $('#subOut').hidden=false; $('#subStatus').textContent='Entry created. Copy or download it below.';
});
$('#subForm').addEventListener('reset',()=>{$('#subOut').hidden=true;$('#subStatus').textContent='';lastEntry=null;});
$('#subCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#subEntry').textContent);$('#subStatus').textContent='Entry copied.';}
  catch(e){const r=document.createRange();r.selectNodeContents($('#subEntry'));const s=getSelection();s.removeAllRanges();s.addRange(r);$('#subStatus').textContent='Copying is blocked here. The entry is selected; press Ctrl+C or ⌘C.';}});

/* ---------- downloads & submissions ---------- */
function toCSV(rows,cols){const esc=v=>{v=Array.isArray(v)?v.join('; '):(v==null?'':String(v));return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  return [cols.join(','),...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n');}
function saveFile(name,text,type){ const url=URL.createObjectURL(new Blob([text],{type})); const a=h('a',{href:url,download:name});
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }
[$('#wcsv'),$('#scsv'),$('#subDl')].forEach(b=>b.hidden=false);
$('#wcsv').addEventListener('click',()=>saveFile('iel-atlas-works.csv',toCSV(worksFiltered(),['id','title','author','date','lang','medium','family','collName','region','url','license','desc']),'text/csv'));
$('#scsv').addEventListener('click',()=>saveFile('iel-atlas-scholarship.csv',toCSV(schFiltered(),['id','authors','year','title','type','container','vol','issue','pages','publisher','doi','url','scope','status','abstract']),'text/csv'));
$('#subDl').addEventListener('click',()=>{ if(lastEntry) saveFile('iel-atlas-entry.json',JSON.stringify(lastEntry,null,2),'application/json'); });
// Optional: send entries straight to the editors (set in config.js).
if(CFG.submitEmail){ const m=$('#subMail'); m.hidden=false; m.addEventListener('click',()=>{ if(!lastEntry) return;
  location.href=`mailto:${CFG.submitEmail}?subject=${encodeURIComponent('IEL Atlas submission: '+lastEntry.title)}&body=${encodeURIComponent(JSON.stringify(lastEntry,null,2))}`; }); }
if(CFG.submitEndpoint){ const s=$('#subSend'); s.hidden=false; s.addEventListener('click',async()=>{ if(!lastEntry) return;
  s.disabled=true; $('#subStatus').textContent='Sending…';
  try{ const r=await fetch(CFG.submitEndpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(lastEntry)});
    $('#subStatus').textContent=r.ok?'Sent. The editors will review your entry.':'The entry could not be sent. Copy or download it instead.'; }
  catch(e){ $('#subStatus').textContent='The entry could not be sent. Copy or download it instead.'; }
  s.disabled=false; }); }

route();
setTimeout(fitIndia,60);
})();
