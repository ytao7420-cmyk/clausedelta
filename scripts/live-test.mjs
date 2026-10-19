// Default is plan-only. No wallet, key, or chain side effects without explicit flags.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {ROOT,LOCAL,CHAIN_ID,RPC,EXPLORER,reader,readJson,readJsonContract,saveJson,acquireLock,testActor,Journal} from './runtime.mjs';
import {loadSources,sha256} from './capture-source.mjs';
import {canonicalJson,verifyComparison} from '../lib/evidence.js';
import {verifyArchive,projectedSources} from './verify-evidence.mjs';
import {summarizeReceipt} from '../lib/receipt.js';
const options=process.argv.slice(2),flag=name=>options.includes(name);
const option=name=>{const inline=options.find(arg=>arg.startsWith(name+'='));if(inline)return inline.slice(name.length+1);const i=options.indexOf(name);return i>=0?options[i+1]:undefined;};
const deploying=flag('--deploy'),running=flag('--run');
const preset=await readJson(new URL('demo-preset.json',import.meta.url));
if(flag('--plan')||(!deploying&&!running)){
  console.log(JSON.stringify({planOnly:true,chainId:CHAIN_ID,network:'GenLayer Studionet',value:'0',leaderOnly:false,deployCommand:'node scripts/live-test.mjs --deploy --source-sha=<reviewed-sha256>',runCommand:'node scripts/live-test.mjs --run',comparisons:preset.comparisons,successfulWorkflowWrites:12,expectedRejectionWrites:1,notice:preset.notice},null,2));process.exit(0);
}
const source=await readFile(new URL('contracts/clausedelta.py',ROOT),'utf8'),sourceSha256=sha256(source);
if(deploying)assert.equal(option('--source-sha'),sourceSha256,'Deployment needs the reviewed exact SHA-256; no wallet or transaction created.');
const unlock=await acquireLock();
try{
  let config=await readJson(new URL('public/deployment.json',ROOT),null);
  if(deploying){
    const deployer=await testActor('deployer');
    const journal=await Journal.load(new URL(`deployment-${sourceSha256}.json`,LOCAL),{chainId:CHAIN_ID,sourceSha256,deployer:deployer.account.address});
    const receipt=await journal.transact('deploy',{kind:'deploy',actor:deployer.account.address,sourceSha256,args:[],value:'0',leaderOnly:false},()=>deployer.deployContract({code:source,args:[],leaderOnly:false}));
    const address=receipt.data?.contract_address??receipt.txDataDecoded?.contractAddress??receipt.to_address;
    assert.match(address??'',/^0x[0-9a-f]{40}$/i);assert.equal(sha256(await reader.getContractCode(address)),sourceSha256);
    const historyPath=new URL('public/evidence/deployments.json',ROOT);
    const history=await readJson(historyPath,{notice:'Historical test deployments; deployment is distinct from successful workflow evidence.',deployments:[]});
    if(config?.deployed&&!history.deployments.some(row=>row.address===config.address))history.deployments.push(config);
    config={deployed:true,network:'GenLayer Studionet',chainId:CHAIN_ID,rpc:RPC,explorer:EXPLORER,address,sourceSha256,deployer:deployer.account.address,deploymentTransaction:journal.state.transactions[0].hash,deploymentReceipt:summarizeReceipt(receipt),verifiedAt:new Date().toISOString(),notice:preset.notice};
    if(!history.deployments.some(row=>row.address===address))history.deployments.push(config);
    await saveJson(historyPath,history);await saveJson(new URL('public/deployment.json',ROOT),config);
    console.log(JSON.stringify({deployed:true,address,sourceSha256,hash:config.deploymentTransaction}));
  }
  if(running){
    assert.ok(config?.deployed);assert.equal(config.chainId,CHAIN_ID);assert.equal(config.rpc,RPC);
    assert.equal(config.sourceSha256,sourceSha256);assert.equal(sha256(await reader.getContractCode(config.address)),sourceSha256);
    const sources=await loadSources(),projections=projectedSources();
    const creator=await testActor('creator'),consumer=await testActor('consumer');
    assert.notEqual(creator.account.address,consumer.account.address);
    const identity={chainId:CHAIN_ID,address:config.address,sourceSha256,sourceDigests:sources.map(s=>s.sha256),presetDigest:sha256(canonicalJson(preset)),creator:creator.account.address,consumer:consumer.account.address};
    const journal=await Journal.load(new URL(`workflow-${config.address.toLowerCase()}.json`,LOCAL),identity);
    const negatives=await Journal.load(new URL(`negative-workflow-${config.address.toLowerCase()}.json`,LOCAL),{...identity,purpose:'consumer mismatch expected rejection'});
    const recovery={recoverLabel:option('--recover-label'),recoverHash:option('--recover-hash')};
    const read=(method,args)=>readJsonContract(config.address,method,args);
    const send=(label,actor,method,args)=>journal.transact(label,{kind:'call',address:config.address,actor:actor.account.address,method,args,value:'0',leaderOnly:false},()=>actor.writeContract({address:config.address,functionName:method,args,value:0n,leaderOnly:false}),recovery);
    const comparisons=[];
    for(const fixture of preset.comparisons){
      const owner=creator.account.address,id=fixture.id;
      await send(`${id}-create`,creator,'create_request',[id,fixture.criterion,...sources.map(s=>s.sha256)]);
      const request=await read('get_request',[owner,id]);
      await send(`${id}-capture`,creator,'capture_sources',[id]);
      const snapshot=await read('get_snapshot',[owner,id]);assert.deepEqual(snapshot.sources,projections[fixture.criterion]);
      await send(`${id}-attest`,creator,'attest',[id]);
      const attestation=await read('get_attestation',[owner,id]);assert.equal(attestation.outcome,fixture.expected);
      await send(`${id}-reliance`,consumer,'record_reliance',[owner,id,id+'-reliance',attestation.digest,fixture.expected]);
      const receipt=await read('get_receipt',[consumer.account.address,id+'-reliance']);
      const item={request,snapshot,attestation,receipt};verifyComparison(item,fixture,projections[fixture.criterion],owner,consumer.account.address);
      assert.deepEqual(await read('get_attestation',[owner,id]),attestation);
      comparisons.push(item);console.log(JSON.stringify({id,outcome:attestation.outcome,receiptDigest:receipt.digest}));
    }
    const args=[creator.account.address,preset.comparisons[0].id,'incorrect-consumer-intent',comparisons[0].attestation.digest,'UNCHANGED'];
    await negatives.transactExpectedRollback('mismatched-outcome',{kind:'call',address:config.address,actor:consumer.account.address,method:'record_reliance',args,value:'0',leaderOnly:false},()=>consumer.writeContract({address:config.address,functionName:'record_reliance',args,value:0n,leaderOnly:false}),'Outcome does not match consumer intent',recovery);
    const negativeReceiptReadBack=await read('get_receipt',[consumer.account.address,'incorrect-consumer-intent']);assert.equal(negativeReceiptReadBack,null);
    await journal.refresh();
    const archive={recordedAt:new Date().toISOString(),network:config.network,chainId:CHAIN_ID,contractAddress:config.address,contractSourceSha256:sourceSha256,presetDigest:identity.presetDigest,notice:preset.notice,actors:{creator:creator.account.address,consumer:consumer.account.address},sources:sources.map(({text,...s})=>s),comparisons,negativeReceiptReadBack,transactions:journal.state.transactions,negativeTransactions:negatives.state.transactions};
    const result=verifyArchive(archive,preset,projections);await saveJson(new URL('public/evidence/demo.json',ROOT),archive);
    console.log(JSON.stringify({complete:true,...result}));
  }
}finally{await unlock();}
