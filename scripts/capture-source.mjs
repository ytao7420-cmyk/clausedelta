import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
export const SOURCES=['https://www.w3.org/TR/2018/REC-WCAG21-20180605/','https://www.w3.org/TR/2023/REC-WCAG22-20231005/'];
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const dir=new URL('../public/evidence/',import.meta.url);
export async function loadSources(){
  const metadata=JSON.parse(await readFile(new URL('sources.json',dir),'utf8'));
  assert.equal(metadata.sources.length,2);
  return Promise.all(metadata.sources.map(async(source,index)=>{
    assert.equal(source.url,SOURCES[index]);
    const bytes=await readFile(new URL(source.file,dir));
    assert.equal(sha256(bytes),source.sha256);assert.equal(bytes.length,source.bytes);
    assert.deepEqual(Buffer.from(bytes.toString('utf8'),'utf8'),bytes);
    return {...source,text:bytes.toString('utf8')};
  }));
}
export async function captureSources(){
  await mkdir(dir,{recursive:true});
  const sources=[];
  for(const [index,url] of SOURCES.entries()){
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(45000)});
    assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer()),file=`wcag2${index+1}.html`;
    assert.ok(bytes.length>100000&&bytes.length<900000);
    assert.deepEqual(Buffer.from(bytes.toString('utf8'),'utf8'),bytes);
    assert.ok(bytes.toString('utf8').includes(url));
    await writeFile(new URL(file,dir),bytes);
    sources.push({url,file,sha256:sha256(bytes),bytes:bytes.length,retrievedAt:new Date().toISOString(),status:200});
  }
  await writeFile(new URL('sources.json',dir),JSON.stringify({notice:'Unmodified fixed W3C Recommendation snapshots. Source license belongs to W3C; see THIRD_PARTY_NOTICES.md. No claim of whole-standard conformance.',sources},null,2)+'\n');
  return sources;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const sources=process.argv.includes('--verify')?await loadSources():await captureSources();
  console.log(JSON.stringify(sources.map(({text,...rest})=>rest),null,2));
}
