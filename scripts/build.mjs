import {mkdir, readFile, writeFile, copyFile, cp, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {defaultSettings, validateSettings} from '@playcanvas/supersplat-viewer/settings';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'docs');
await mkdir(path.join(output, 'model'), {recursive:true});
await mkdir(path.join(output, 'vendor'), {recursive:true});
for (const name of ['index.html','app.js','style.css','poster.jpg']) await copyFile(path.join(root,'site',name),path.join(output,name));
const vendorRoot = path.join(root,'node_modules/@playcanvas/supersplat-viewer');
await copyFile(path.join(vendorRoot,'public/index.js'),path.join(output,'vendor/viewer.js'));
await copyFile(path.join(vendorRoot,'public/index.css'),path.join(output,'vendor/viewer.css'));
await copyFile(path.join(vendorRoot,'LICENSE'),path.join(output,'vendor/LICENSE'));
await copyFile(path.join(vendorRoot,'THIRD_PARTY_NOTICES.md'),path.join(output,'vendor/THIRD_PARTY_NOTICES.md'));
const poses=JSON.parse(await readFile(path.join(root,'site/camera-poses.json'),'utf8'));
const settings=defaultSettings('object');
settings.tonemapping='none';
settings.highPrecisionRendering=true;
settings.cameras=[{initial:{position:poses[0].position,target:poses[0].target,fov:poses[0].fov}}];
settings.annotations=poses.map((p,i)=>({position:p.target,title:`视角 ${i+1}`,text:'由训练场景相机配置生成的观察视角',camera:{initial:{position:p.position,target:p.target,fov:p.fov}}}));
validateSettings(settings);
await writeFile(path.join(output,'settings.json'),JSON.stringify(settings,null,2));
const model=await readFile(path.join(root,'.cache/truck.compressed.ply'));
const hash=data=>createHash('sha256').update(data).digest('hex');
const parts=[];
const chunkSize=32*1024*1024;
for(let offset=0,i=0;offset<model.length;offset+=chunkSize,i++) {
  const chunk=model.subarray(offset,Math.min(offset+chunkSize,model.length));
  const filename=`truck-${String(i).padStart(2,'0')}.bin`;
  await writeFile(path.join(output,'model',filename),chunk);
  parts.push({url:`./model/${filename}`,bytes:chunk.length,sha256:hash(chunk)});
}
const manifest={filename:'truck.compressed.ply',format:'PlayCanvas compressed PLY',gaussians:2574495,shDegree:3,bytes:model.length,sha256:hash(model),parts,
  original:{filename:'point_cloud.ply',bytes:638476292,trainingIterations:30000},
  conversion:{tool:'@playcanvas/splat-transform',version:'3.10.3',operation:'format conversion only; quantized; no pruning or SH-band removal'},
  quality:{note:'Original-model test metrics, not remeasured after web compression',testViews:32,width:979,height:546,PSNR:25.41135597229004,SSIM:0.8821740746498108,LPIPS:0.146658793091774}};
await writeFile(path.join(output,'model/manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(path.join(output,'.nojekyll'),'');
console.log(JSON.stringify({output,compressedModelMiB:model.length/2**20,parts:parts.length,maxPartMiB:Math.max(...parts.map(x=>x.bytes))/2**20},null,2));
