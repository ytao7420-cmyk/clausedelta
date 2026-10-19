// Read-only: retain full RPC receipts locally and publish selected result fields.
import assert from 'node:assert/strict';
import {abi} from 'genlayer-js';
import {ROOT,LOCAL,reader,readJson,saveJson} from './runtime.mjs';
import {assertExecutionSucceeded,assertExpectedRollback} from '../lib/receipt.js';
const deployment=await readJson(new URL('public/deployment.json',ROOT));
const archive=await readJson(new URL('public/evidence/demo.json',ROOT));
const refs=[{label:'deploy',hash:deployment.deploymentTransaction},...archive.transactions.map(tx=>({label:tx.label,hash:tx.hash})),...archive.negativeTransactions.map(tx=>({label:tx.label,hash:tx.hash,expectedRejection:true}))];
const existing=process.argv.includes('--from-local')?await readJson(new URL('raw-transcripts.json',LOCAL)):null;
const full=[],published=[];
for(const ref of refs){
  const receipt=existing?existing.receipts.find(row=>row.reference.hash===ref.hash)?.receipt:await reader.getTransaction({hash:ref.hash});
  assert.ok(receipt);assert.equal(receipt.hash,ref.hash);
  const tx=[...archive.transactions,...archive.negativeTransactions].find(row=>row.hash===ref.hash);
  if(tx){
    assert.equal(receipt.from_address.toLowerCase(),tx.spec.actor.toLowerCase());
    assert.equal(receipt.to_address.toLowerCase(),tx.spec.address.toLowerCase());
    assert.deepEqual(Uint8Array.from(receipt.data.calldata.raw),abi.calldata.encode(abi.calldata.makeCalldataObject(tx.spec.method,tx.spec.args,undefined)));
  }
  if(ref.expectedRejection)assertExpectedRollback(receipt,'Outcome does not match consumer intent');else assertExecutionSucceeded(receipt);
  assert.equal(receipt.leader_only,false);full.push({reference:ref,receipt});
  const raw=receipt.consensus_data?.leader_receipt,leaders=Array.isArray(raw)?raw:raw?[raw]:[];
  published.push({reference:ref,hash:receipt.hash,from_address:receipt.from_address,to_address:receipt.to_address,data:{calldata:receipt.data?.calldata??null,contract_address:receipt.data?.contract_address??null},statusName:receipt.statusName??receipt.status_name??receipt.status,result_name:receipt.result_name??receipt.resultName??receipt.result,leader_only:receipt.leader_only,consensus_data:{votes:receipt.consensus_data?.votes??{},leader_receipt:leaders.map(row=>({mode:row.mode,execution_result:row.execution_result,result:row.result}))}});
}
const recordedAt=existing?.recordedAt??new Date().toISOString();
if(!existing)await saveJson(new URL('raw-transcripts.json',LOCAL),{recordedAt,receipts:full});
await saveJson(new URL('public/evidence/transcripts.json',ROOT),{notice:'Selected public receipt fields re-read from Studionet RPC. All actors are project-controlled. Full raw RPC replies retained privately; no keys or session data published. Expected rollback remains ERROR.',recordedAt,chainId:61999,contractAddress:archive.contractAddress,receipts:published});
console.log(JSON.stringify({receipts:published.length,successful:published.filter(row=>!row.reference.expectedRejection).length,expectedRejections:published.filter(row=>row.reference.expectedRejection).length}));
