import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
test('Un seul parcours complet, sans listes de trains ni métros',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/id="journey-panel"/);assert.doesNotMatch(html,/id="train-list"|id="metro-list"|id="morning"|id="evening"/);
 assert.match(html,/Richard · M2/);assert.match(html,/Louis · M1/);
});
test('Interface automatique : aucun bouton de sens et aucune liste de train',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html, /data-mode=|<select|id="journey-train"/);
 const ui=await readFile(new URL('../js/journey-ui.mjs',import.meta.url),'utf8');
 assert.match(ui,/const mode='auto',trainId='auto'/);
 assert.doesNotMatch(ui,/\$\('journey-train'\)/);
});
