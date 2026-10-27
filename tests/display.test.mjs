import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
test('Les trains restent affichés même si le rendu et l’initialisation métro échouent',async()=>{
 const source=(await readFile(new URL('../js/app.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',style:{},classList:{toggle(){}},addEventListener(){}});return nodes.get(id)};
 const data={trains:[{number:'a',direction:'morning',departure:'06:47',arrival:'07:07'},{number:'b',direction:'evening',departure:'17:13',arrival:'17:27'}],from:'27/10/2026',to:'31/03/2027',generatedAt:new Date().toISOString(),liveAvailable:false,liveWindow:false};
 const context={document:{getElementById:node,addEventListener(){},hidden:false},Intl,Date,AbortController,setInterval(){},console:{error(){},warn(){}},selectWatch:()=>null,watchKey:()=>'',getTrainData:async()=>data,initJourney(){throw Error('Metro init failure')},updateJourney(){throw Error('Metro render failure')}};
 vm.runInNewContext(source,context);await new Promise(r=>setImmediate(r));
 assert.match(node('morning').innerHTML,/06:47/);assert.match(node('evening').innerHTML,/17:13/);assert.equal(node('refresh').disabled,false);
});
test('Trains ouverts et deux listes de métros explicites dans la page',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<section id="train-list"/);assert.ok(!html.includes('<details class="train-details">'));
 assert.match(html,/id="metro-now-richard"/);assert.match(html,/id="metro-now-louis"/);
 assert.match(html,/Richard · M2/);assert.match(html,/Louis · M1/);
});

test('Interface automatique : aucun bouton de sens et aucune liste de train',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html, /data-mode=|<select|id="journey-train"/);
 const ui=await readFile(new URL('../js/journey-ui.mjs',import.meta.url),'utf8');
 assert.match(ui,/const mode='auto',trainId='auto'/);
 assert.doesNotMatch(ui,/\$\('journey-train'\)/);
});
