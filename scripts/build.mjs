import {rm,mkdir,cp,readFile} from 'node:fs/promises';
const schedule=JSON.parse(await readFile('data/schedule.json','utf8'));
if(!schedule.trains?.length) throw Error('Horaires manquants');
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const path of ['index.html','.nojekyll','js','data']) await cp(path,'dist/'+path,{recursive:true});
console.log('GitHub Pages prêt : dist/');
