import {initRoad,currentRoad} from './road.mjs';
import {planJourney,PROFILES,hhmm,trainSeconds} from './journeys.mjs';
import {fetchTraffic,TRAFFIC_OFFICIAL,trafficIndicator} from './traffic.mjs';
import {parisClock} from './watch.mjs';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatLocalDate=s=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
const localDate=s=>Number.isFinite(Date.parse(s))?formatLocalDate(s):'date non précisée';
const mode='auto',trainId='auto';
let profile='richard',walk=5,safety=5,access=0,latest=null,metro=null,metroPromise,traffic=null,metroError=false;
try{const settings=JSON.parse(localStorage.getItem('mes-trains-metro-v2')||'{}');if(PROFILES[settings.profile])profile=settings.profile;for(const [key,assign] of [['walk',v=>walk=v],['safety',v=>safety=v],['access',v=>access=v]])if(Number.isFinite(settings[key])&&settings[key]>=0&&settings[key]<=30)assign(settings[key]);}catch{}
const save=()=>{try{localStorage.setItem('mes-trains-metro-v2',JSON.stringify({profile,walk,safety,access}))}catch{}};
function updateControls(){
 document.querySelectorAll('[data-profile]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profile===profile)));
 for(const [id,v] of [['walk-margin',walk],['safety-margin',safety],['station-access',access]])$(id).value=v;
}
function drawTraffic(){
 for(const line of ['M2','M1']){
  const view=trafficIndicator(traffic?.[line]),person=line==='M2'?'Richard':'Louis',station=line==='M2'?'Mons Sarts':'Pont de Bois';
  const target=$('traffic-'+line);target.hidden=PROFILES[profile].line!==line;target.className='traffic-card traffic-'+view.tone;
  const checked=traffic?'Vérifié le '+localDate(traffic.checkedAt):'Source indisponible pour le moment';
  target.innerHTML='<div class="traffic-head"><span class="line-badge '+line+'">'+line+'</span><div><strong>'+person+'</strong><span class="traffic-route">Lille-Flandres ↔ '+station+'</span></div></div><div class="traffic-status"><span class="traffic-light" aria-hidden="true"></span>'+view.label+'</div>';
  if(view.tone==='bad')target.innerHTML+='<div class="traffic-reasons">'+view.messages.map(m=>'<p>'+escape(m.text)+'</p>').join('')+'</div>';
  target.innerHTML+='<span class="traffic-note">'+escape(checked)+(view.tone==='good'?' · Selon les alertes reçues':view.tone==='unknown'?' · Information absente ou trop ancienne':'')+'</span>';
  if(view.tone!=='good')target.innerHTML+='<a href="'+TRAFFIC_OFFICIAL+'" target="_blank" rel="noopener">Vérifier sur Ilévia ↗</a>';
 }
}

const icons={car:'<path d="m5 8 2-4h10l2 4M3 9h18v10H3zM6 19v2m12-2v2M3 13h18"/><circle cx="6" cy="16" r="1"/><circle cx="18" cy="16" r="1"/>',train:'<rect x="5" y="3" width="14" height="16" rx="4"/><path d="M5 11h14M12 3v8M8 22l2-3m6 3-2-3"/><path d="M8 15h1m6 0h1"/>',walk:'<circle cx="14" cy="4" r="2"/><path d="m8 22 3-7-3-4 4-4 3 5 4 1M5 12l3-3m3 6 5 3 1 4"/>',metro:'<circle cx="12" cy="12" r="9"/><path d="M7 16V8l5 5 5-5v8"/>'};
const icon=type=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[type]+'</svg>';
const step=(start,end,title,route,detail,type,line='')=>'<li class="journey-step '+type+' '+line+'"><div class="segment-time"><strong>'+hhmm(start)+'</strong><span>'+hhmm(end)+'</span></div><span class="segment-icon">'+icon(type)+'</span><div class="step-copy"><span class="transport-label">'+(type==='car'?'Voiture':type==='train'?'Train TER':type==='walk'?'À pied':'Métro '+line)+' · '+Math.ceil((end-start)/60)+' min</span><strong>'+escape(title)+'</strong><span class="segment-route">'+escape(route)+'</span><span class="segment-detail">'+escape(detail)+'</span></div></li>';

function errorTitle(code){return ({'train-cancelled':'Ce train est supprimé.','train-missing':'Ce train n’est pas disponible à cette date.','metro-date':'Pas d’horaires métro pour cette date.','no-metro':'Plus de métro prévu pour ce trajet aujourd’hui.','missed-connection':'Ce train n’est plus atteignable avec vos marges.','no-train':'Plus de correspondance dans vos créneaux de train.'})[code]||'Correspondance indisponible.'}
function render(){
 if(!latest)return;
 const {data,day}=latest;updateControls();drawTraffic();const road=currentRoad(day,new Date());
 if(road.blocked){$('journey-result').innerHTML='<div class="connection-alert">Calculez votre temps de route pour choisir un train accessible, ou indiquez que vous êtes déjà à la gare.</div>';return}
 if(!metro){$('journey-result').innerHTML='<p>'+(metroError?'Impossible de charger les horaires Ilévia. Utilisez Actualiser pour réessayer.':'Chargement des horaires métro officiels…')+'</p>';return}
 const now=new Date(),p=PROFILES[profile];
 const result=planJourney({trains:data.trains,metro,profile,mode,day,now,walk,safety,access,trainId,originAccess:road.active?road.totalSeconds:0});
 $('journey-mode-label').textContent=(result.leg==='out'?'Aller du matin':'Retour vers Armentières')+' · '+new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(now)+' Paris';
 const blocked=traffic?.[p.line]?.state==='interrupted';
 let html='<div class="journey-heading"><div><span class="journey-kicker">'+escape(p.name)+' · '+(result.current?'TRAJET DU JOUR':'PRÉVISION À LA DATE CHOISIE')+'</span><h2>'+(result.leg==='out'?(road.active?'Votre position → ':'Armentières → ')+p.station:p.station+' → Armentières')+'</h2></div><span class="line-badge '+p.line+'">'+p.line+'</span></div>';
 html+='<p class="journey-direction">Métro '+p.line+' · direction '+escape(result.metro?.direction||(result.leg==='out'?p.out:p.back))+'</p>';
 if(blocked)html+='<div class="connection-alert" role="alert">Une interruption récente est signalée sur '+p.line+'. Cette correspondance théorique n’est pas confirmée : consultez Ilévia avant de partir.</div>';
 if(result.error){html+='<div class="connection-alert">'+errorTitle(result.error)+'</div>';if(result.error==='no-train')html+='<p class="journey-description">Les trains recherchés sont limités à 06:45–07:45 à l’aller et 17:00–18:30 au retour.</p>';html+='<a class="journey-link" href="'+TRAFFIC_OFFICIAL+'" target="_blank" rel="noopener">Horaires et trafic Ilévia ↗</a>';
 }else{
  const t=result.train,m=result.metro;const steps=[];
  const departure=result.leg==='out'?trainSeconds(t,'departure',day)-(road.active?road.totalSeconds:0):m.departure-access*60;
  const arrival=result.leg==='out'?m.arrival:trainSeconds(t,'arrival',day);
  html+='<section class="trip-overview" aria-label="Horaires du trajet"><div><span>Départ · '+(result.leg==='out'?(road.active?'votre position':'gare d’Armentières'):escape(p.station))+'</span><strong>'+hhmm(departure)+'</strong></div><div><span>Arrivée · '+(result.leg==='out'?escape(p.station):'gare d’Armentières')+'</span><strong>'+hhmm(arrival)+'</strong></div><p>'+Math.ceil((arrival-departure)/60)+' min au total · '+(road.active?'Voiture + train + métro':'1 correspondance')+'</p></section>';
  if(t)html+='<p class="journey-direction">TER '+escape(t.number)+' · '+(t.realtime?(t.delay>0?'Retard SNCF : +'+t.delay+' min':'À l’heure selon la SNCF'):'Horaire prévu · temps réel non confirmé')+(t.platform?' · Voie '+escape(t.platform):'')+'</p>';
  if(result.leg==='out'){
   const td=trainSeconds(t,'departure',day),ta=trainSeconds(t,'arrival',day);
   if(road.active){const driving=Math.ceil(road.route.durationSeconds/60)*60;steps.push(step(departure,departure+driving,'Rejoindre la gare d’Armentières','Votre position → place de la Gare',road.route.source==='manual'?'Durée saisie · sans trafic en direct':'OSRM · estimation sans trafic routier en direct','car'));steps.push(step(departure+driving,td,'Stationner et rejoindre le quai','Gare d’Armentières',road.parking+' min de stationnement et accès au quai + '+road.buffer+' min de prudence','walk'))}

   steps.push(step(td,ta,'Armentières → Lille-Flandres','TER '+t.number+(t.platform?' · Voie '+t.platform:''),t.realtime?'Horaire SNCF actualisé':'Horaire prévu','train'));
   steps.push(step(ta,result.ready,'Correspondance à Lille-Flandres','Quai du train → quai du métro',walk+' min de marche · puis '+Math.max(0,Math.floor((m.departure-result.ready)/60))+' min d’attente','walk'));
   steps.push(step(m.departure,m.arrival,'Lille-Flandres → '+p.station,'Direction '+m.direction,'Passage prévu Ilévia','metro',p.line));
  }else{
   if(access)steps.push(step(m.departure-access*60,m.departure,'Rejoindre '+p.station,'Point de départ → quai du métro',access+' min d’accès selon votre réglage','walk'));
   steps.push(step(m.departure,m.arrival,p.station+' → Lille-Flandres','Direction '+m.direction,'Passage prévu Ilévia','metro',p.line));
   steps.push(step(m.arrival,m.arrival+walk*60,'Correspondance à Lille-Flandres','Quai du métro → quai du train',walk+' min de marche · puis '+Math.floor(result.slack)+' min de marge avant le train','walk'));
   steps.push(step(trainSeconds(t,'departure',day),trainSeconds(t,'arrival',day),'Lille-Flandres → Armentières','TER '+t.number+(t.platform?' · Voie '+t.platform:''),t.realtime?'Horaire SNCF actualisé':'Horaire prévu','train'));
  }
  html+='<section class="route-card" aria-label="Étapes du parcours"><div class="route-card-title"><h3>Votre parcours</h3><span>'+steps.length+' étapes</span></div><ol class="journey-timeline">'+steps.join('')+'</ol></section>';
  const currentSeconds=parisClock(now).minute*60+now.getUTCSeconds();const nextDeparture=result.leg==='out'&&t&&trainSeconds(t,'departure',day)>=currentSeconds?departure:m.departure-access*60;const delta=Math.ceil((nextDeparture-currentSeconds)/60);
  html+='<div class="journey-summary">'+(blocked?'Trajet théorique à revalider':result.current?(delta>0?'Prochain départ dans '+(delta>=60?Math.floor(delta/60)+' h '+String(delta%60).padStart(2,'0'):delta+' min'):'Départ imminent ou déjà effectué · vérifiez le passage'):'Prévision pour le '+escape(day.split('-').reverse().join('/')))+'<span>'+ (result.leg==='out'?'La correspondance se recalcule si l’arrivée du train change.':'Métro et train calculés avec vos marges de marche et de sécurité.')+'</span></div>';
 }
 html+='<p class="journey-description">Métro : horaires prévus, pas de position de rame en direct. Trafic indiqué sous votre parcours. Choix parmi vos trains de 06:45–07:45 et 17:00–18:30 : arrivée la plus tôt possible, avec vos marges.</p>';
 $('journey-result').innerHTML=html;
 $('metro-source').textContent='Horaires Ilévia téléchargés le '+localDate(metro.generatedAt)+' · du '+metro.from.split('-').reverse().join('/')+' au '+metro.to.split('-').reverse().join('/')+'.';
}
async function loadMetro(){
 if(!metroPromise)metroPromise=fetch(new URL('../data/metro.json',import.meta.url),{cache:'no-cache'}).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(!d.groups||!d.services)throw Error();metro=d;metroError=false;render();return d}).catch(()=>{metroError=true;metroPromise=null;render()});
 return metroPromise;
}
export function updateJourney(data,day){latest={data,day};if(!metro)loadMetro();try{render()}catch(error){console.error('Affichage correspondance :',error);$('journey-result').textContent='Le calcul de correspondance est temporairement indisponible. Utilisez Actualiser pour réessayer.';}}
async function refreshTraffic(){try{traffic=await fetchTraffic()}catch{traffic=null}drawTraffic();render();}
export function initJourney(){
 initRoad(render);
 document.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>{profile=b.dataset.profile;save();render()});
 for(const [id,set] of [['walk-margin',v=>walk=v],['safety-margin',v=>safety=v],['station-access',v=>access=v]])$(id).onchange=()=>{let v=Number($(id).value);if(!Number.isFinite(v))v=5;set(Math.max(0,Math.min(30,v)));save();render()};
 $('refresh').addEventListener('click',()=>{loadMetro();refreshTraffic()});
 updateControls();drawTraffic();loadMetro();refreshTraffic();setInterval(()=>{if(!document.hidden)refreshTraffic()},120000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshTraffic()});
}
