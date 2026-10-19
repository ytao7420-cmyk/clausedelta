import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {abi} from 'genlayer-js';
import {assertExecutionSucceeded,assertExpectedRollback} from '../lib/receipt.js';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {loadSources,sha256} from './capture-source.mjs';
import {verifyComparison,canonicalJson} from '../lib/evidence.js';
export function projectedSources(){return JSON.parse(execFileSync('python3',[fileURLToPath(new URL('./extract-source.py',import.meta.url))],{encoding:'utf8',maxBuffer:1024*1024}));}
export function verifyNegativeTransaction(tx,archive){
  assert.match(tx.hash,/^0x[0-9a-f]{64}$/i);
  assert.ok(['ACCEPTED','FINALIZED'].includes(tx.status),'Expected rejection requires accepted lifecycle');
  assert.equal(tx.consensusResult,'MAJORITY_AGREE','Expected rejection must be agreed by validators');
  assert.equal(tx.execution,'ERROR');assert.equal(tx.expectedRollbackVerified,true);
  assert.equal(tx.decodedRollback,'Outcome does not match consumer intent');assert.equal(tx.leaderOnly,false);
  assert.equal(tx.spec.kind,'call','Negative transaction must be a contract call');
  assert.equal(tx.spec.address,archive.contractAddress,'Negative transaction targets another contract');
  assert.equal(tx.spec.actor,archive.actors.consumer,'Negative actor differs from consumer');
  assert.equal(tx.spec.value,'0');
}
export function verifyPublicTranscripts(transcripts,archive,deployment){
  assert.equal(transcripts.chainId,61999);assert.equal(transcripts.contractAddress,archive.contractAddress);
  assert.equal(transcripts.receipts.length,14);
  const expected=[{label:'deploy',hash:deployment.deploymentTransaction},...archive.transactions,...archive.negativeTransactions];
  for(const [i,row] of transcripts.receipts.entries()){
    const tx=expected[i];assert.equal(row.reference.hash,tx.hash);assert.equal(row.hash,tx.hash);assert.equal(row.reference.label,tx.label);
    if(i===13)assertExpectedRollback(row,'Outcome does not match consumer intent');else assertExecutionSucceeded(row);
    if(i===0){assert.equal(row.from_address.toLowerCase(),deployment.deployer.toLowerCase());continue;}
    assert.equal(row.from_address.toLowerCase(),tx.spec.actor.toLowerCase());assert.equal(row.to_address.toLowerCase(),archive.contractAddress.toLowerCase());
    assert.deepEqual(Uint8Array.from(row.data.calldata.raw),abi.calldata.encode(abi.calldata.makeCalldataObject(tx.spec.method,tx.spec.args,undefined)));
  }
  return {verifiedPublicTranscripts:14};
}
export function verifyArchive(archive,preset,projections){
  assert.equal(archive.chainId,61999);assert.equal(archive.comparisons.length,3);
  assert.equal(archive.presetDigest,sha256(canonicalJson(preset)));
  assert.equal(archive.transactions.length,12);
  for(const tx of archive.transactions){
    assert.match(tx.hash,/^0x[0-9a-f]{64}$/i);assert.ok(['ACCEPTED','FINALIZED'].includes(tx.status));
    assert.equal(tx.execution,'SUCCESS');assert.equal(tx.consensusResult,'MAJORITY_AGREE');assert.equal(tx.leaderOnly,false);
    assert.equal(tx.spec.address,archive.contractAddress);assert.equal(tx.spec.value,'0');assert.equal(tx.spec.leaderOnly,false);
  }
  assert.equal(new Set(archive.transactions.map(tx=>tx.hash)).size,12);
  for(const [index,item] of archive.comparisons.entries()){
    const fixture=preset.comparisons[index];verifyComparison(item,fixture,projections[fixture.criterion],archive.actors.creator,archive.actors.consumer);
    const expectedCalls=[['create_request',[fixture.id,fixture.criterion,item.request.old_sha256,item.request.new_sha256]],['capture_sources',[fixture.id]],['attest',[fixture.id]],['record_reliance',[archive.actors.creator,fixture.id,fixture.id+'-reliance',item.attestation.digest,fixture.expected]]];
    for(const [offset,[method,args]] of expectedCalls.entries()){
      const tx=archive.transactions[index*4+offset];assert.equal(tx.spec.method,method);assert.deepEqual(tx.spec.args,args);
      assert.equal(tx.spec.actor.toLowerCase(),archive.actors[offset===3?'consumer':'creator'].toLowerCase());
    }
  }
  assert.equal(archive.negativeTransactions.length,1);
  const negative=archive.negativeTransactions[0];
  verifyNegativeTransaction(negative,archive);
  assert.equal(negative.execution,'ERROR');assert.equal(negative.expectedRollbackVerified,true);assert.equal(negative.decodedRollback,'Outcome does not match consumer intent');
  assert.equal(negative.leaderOnly,false);assert.equal(negative.consensusResult,'MAJORITY_AGREE');
  assert.equal(archive.negativeReceiptReadBack,null);
  assert.equal(negative.spec.method,'record_reliance');assert.equal(negative.spec.args.at(-1),'UNCHANGED');
  assert.equal(negative.spec.args[1],preset.comparisons[0].id);assert.equal(negative.spec.args[2],'incorrect-consumer-intent');
  assert.equal(negative.spec.args[3],archive.comparisons[0].attestation.digest);
  assert.equal(negative.spec.address,archive.contractAddress);assert.equal(negative.spec.actor,archive.actors.consumer);
  return {comparisons:3,successfulWorkflowTransactions:12,expectedRejectionTransactions:1,outcomes:archive.comparisons.map(item=>item.attestation.outcome)};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  await loadSources();
  const root=new URL('../',import.meta.url);
  const archive=JSON.parse(await readFile(new URL('public/evidence/demo.json',root),'utf8'));
  const preset=JSON.parse(await readFile(new URL('scripts/demo-preset.json',root),'utf8'));
  assert.equal(archive.contractSourceSha256,sha256(await readFile(new URL('contracts/clausedelta.py',root))));
  const deployment=JSON.parse(await readFile(new URL('public/deployment.json',root),'utf8'));
  const transcripts=JSON.parse(await readFile(new URL('public/evidence/transcripts.json',root),'utf8'));
  console.log(JSON.stringify({...verifyArchive(archive,preset,projectedSources()),...verifyPublicTranscripts(transcripts,archive,deployment)},null,2));
}
