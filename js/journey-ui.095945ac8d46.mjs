import {planJourney,PROFILES,hhmm,trainSeconds} from './journeys.095945ac8d46.mjs';
import {fetchTraffic,TRAFFIC_OFFICIAL,trafficIndicator} from './traffic.095945ac8d46.mjs';
import {parisClock} from './watch.095945ac8d46.mjs';
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

const step=(time,title,detail,kind='')=>'<li class="journey-step"><span class="step-time">'+escape(time)+'</span><div class="step-copy"><strong>'+escape(title)+'</strong><span>'+escape(detail)+'</span>'+(kind?'<em>'+escape(kind)+'</em>':'')+'</div></li>';
function errorTitle(code){return ({'train-cancelled':'Ce train est supprimé.','train-missing':'Ce train n’est pas disponible à cette date.','metro-date':'Pas d’horaires métro pour cette date.','no-metro':'Plus de métro prévu pour ce trajet aujourd’hui.','missed-connection':'Ce train n’est plus atteignable avec vos marges.','no-train':'Plus de correspondance dans vos créneaux de train.'})[code]||'Correspondance indisponible.'}
function render(){
 if(!latest)return;
 const {data,day}=latest;updateControls();drawTraffic();
 if(!metro){$('journey-result').innerHTML='<p>'+(metroError?'Impossible de charger les horaires Ilévia. Utilisez Actualiser pour réessayer.':'Chargement des horaires métro officiels…')+'</p>';return}
 const now=new Date(),p=PROFILES[profile];
 const result=planJourney({trains:data.trains,metro,profile,mode,day,now,walk,safety,access,trainId});
 $('journey-mode-label').textContent=(mode==='auto'?'Auto · ':'')+(result.leg==='out'?'Aller du matin':'Retour vers Armentières')+' · '+new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(now)+' Paris';
 const blocked=traffic?.[p.line]?.state==='interrupted';
 let html='<div class="journey-heading"><div><span class="journey-kicker">'+escape(p.name)+' · '+(result.current?'TRAJET DU JOUR':'PRÉVISION À LA DATE CHOISIE')+'</span><h2>'+(result.leg==='out'?'Armentières → '+p.station:p.station+' → Armentières')+'</h2></div><span class="line-badge '+p.line+'">'+p.line+'</span></div>';
 html+='<p class="journey-direction">Métro '+p.line+' · direction '+escape(result.metro?.direction||(result.leg==='out'?p.out:p.back))+'</p>';
 if(blocked)html+='<div class="connection-alert" role="alert">Une interruption récente est signalée sur '+p.line+'. Cette correspondance théorique n’est pas confirmée : consultez Ilévia avant de partir.</div>';
 if(result.error){html+='<div class="connection-alert">'+errorTitle(result.error)+'</div>';if(result.error==='no-train')html+='<p class="journey-description">Les trains recherchés sont limités à 06:45–07:45 à l’aller et 17:00–18:30 au retour.</p>';html+='<a class="journey-link" href="'+TRAFFIC_OFFICIAL+'" target="_blank" rel="noopener">Horaires et trafic Ilévia ↗</a>';
 }else{
  const t=result.train,m=result.metro;const steps=[];
  const departure=result.leg==='out'?trainSeconds(t,'departure',day):m.departure-access*60;
  const arrival=result.leg==='out'?m.arrival:trainSeconds(t,'arrival',day);
  html+='<div class="trip-overview"><div><span>Départ '+(result.leg==='out'?'gare d’Armentières':escape(p.station))+'</span><strong>'+hhmm(departure)+'</strong></div><div><span>Arrivée '+(result.leg==='out'?escape(p.station):'gare d’Armentières')+'</span><strong>'+hhmm(arrival)+'</strong></div><p>'+Math.ceil((arrival-departure)/60)+' min · Train + marche + métro</p></div>';
  if(t)html+='<p class="journey-direction">TER '+escape(t.number)+' · '+(t.realtime?(t.delay>0?'Retard SNCF : +'+t.delay+' min':'À l’heure selon la SNCF'):'Horaire prévu · temps réel non confirmé')+(t.platform?' · Voie '+escape(t.platform):'')+'</p>';
  if(result.leg==='out'){
   if(t){steps.push(step(hhmm(trainSeconds(t,'departure',day)),'Train au départ d’Armentières','TER '+t.number,t.realtime?'Départ SNCF actualisé':'Départ prévu'));steps.push(step(hhmm(trainSeconds(t,'arrival',day)),'Arrivée à Lille-Flandres',t.expectedArrival?'Arrivée SNCF actualisée':'Arrivée prévue · à confirmer'))}
   else steps.push(step(result.current?hhmm(parisClock(now).minute*60):'—','Depuis Lille-Flandres','Plus de train proposé dans le créneau du matin : calcul depuis la gare, si vous y êtes déjà.'));
   steps.push(step(hhmm(result.ready),'Prêt sur le quai du métro',walk+' min pour rejoindre le métro'));
   steps.push(step(hhmm(m.departure),'Métro '+p.line+' conseillé','Direction '+m.direction,'Passage prévu Ilévia'));
   steps.push(step(hhmm(m.arrival),'Arrivée à '+p.station,'Durée issue des horaires Ilévia','Arrivée prévue'));
  }else{
   if(access)steps.push(step(hhmm(m.departure-access*60),'Rejoindre la station '+p.station,access+' min de marche jusqu’au quai'));
   steps.push(step(hhmm(m.departure),'Métro '+p.line+' depuis '+p.station,(result.latest?'Dernier passage compatible avec ce train':result.leaveLater?'Départ conseillé pour éviter une longue attente en gare':'Prochain métro compatible')+' · '+(access?access+' min d’accès à la station':'Calcul depuis le quai de la station'),'Passage prévu Ilévia'));
   steps.push(step(hhmm(m.arrival),'Arrivée du métro à Lille-Flandres','Puis '+walk+' min de marche vers le quai du train'));
   steps.push(step(hhmm(m.arrival+walk*60),'Prêt au quai du train','Marge restante : '+Math.floor(result.slack)+' min · minimum demandé : '+safety+' min'));
   steps.push(step(hhmm(trainSeconds(t,'departure',day)),'Train vers Armentières','TER '+t.number,t.realtime?'Départ SNCF actualisé':'Départ prévu'));
   steps.push(step(hhmm(trainSeconds(t,'arrival',day)),'Arrivée à Armentières',t.expectedArrival?'Arrivée SNCF actualisée':'Arrivée prévue'));
  }
  html+='<ol class="journey-timeline">'+steps.join('')+'</ol>';
  const currentSeconds=parisClock(now).minute*60+now.getUTCSeconds();const nextDeparture=result.leg==='out'&&t&&trainSeconds(t,'departure',day)>=currentSeconds?trainSeconds(t,'departure',day):m.departure-access*60;const delta=Math.ceil((nextDeparture-currentSeconds)/60);
  html+='<div class="journey-summary">'+(blocked?'Trajet théorique à revalider':result.current?(delta>0?'Prochain départ dans '+(delta>=60?Math.floor(delta/60)+' h '+String(delta%60).padStart(2,'0'):delta+' min'):'Départ imminent ou déjà effectué · vérifiez le passage'):'Prévision pour le '+escape(day.split('-').reverse().join('/')))+'<span>'+ (result.leg==='out'?'La correspondance se recalcule si l’arrivée du train change.':'Métro et train calculés avec vos marges de marche et de sécurité.')+'</span></div>';
 }
 html+='<p class="journey-description">Métro : horaires prévus, pas de position de rame en direct. Trafic indiqué ci-dessus. Choix parmi vos trains de 06:45–07:45 et 17:00–18:30 : arrivée la plus tôt possible, avec vos marges.</p>';
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
 document.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>{profile=b.dataset.profile;save();render()});
 for(const [id,set] of [['walk-margin',v=>walk=v],['safety-margin',v=>safety=v],['station-access',v=>access=v]])$(id).onchange=()=>{let v=Number($(id).value);if(!Number.isFinite(v))v=5;set(Math.max(0,Math.min(30,v)));save();render()};
 $('refresh').addEventListener('click',()=>{loadMetro();refreshTraffic()});
 updateControls();drawTraffic();loadMetro();refreshTraffic();setInterval(()=>{if(!document.hidden)refreshTraffic()},120000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshTraffic()});
}
