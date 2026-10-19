import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyPublicTranscripts} from '../scripts/verify-evidence.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../public/'+name,import.meta.url),'utf8'));
const archive=read('evidence/demo.json'),transcripts=read('evidence/transcripts.json'),deployment=read('deployment.json');
const clone=()=>structuredClone(transcripts);
test('retained actual chain transcripts bind every successful and negative call',()=>{
  assert.deepEqual(verifyPublicTranscripts(transcripts,archive,deployment),{verifiedPublicTranscripts:14});
});
test('altered transaction hash cannot masquerade as the public execution',()=>{
  const changed=clone();changed.receipts[1].hash='0x'+'f'.repeat(64);
  assert.throws(()=>verifyPublicTranscripts(changed,archive,deployment));
});
test('correct result from the wrong actor is not accepted',()=>{
  const changed=clone();changed.receipts[1].from_address='0x'+'f'.repeat(40);
  assert.throws(()=>verifyPublicTranscripts(changed,archive,deployment));
});
test('correct-looking summary with modified actual calldata is rejected',()=>{
  const changed=clone();changed.receipts[4].data.calldata.raw[0]^=1;
  assert.throws(()=>verifyPublicTranscripts(changed,archive,deployment));
});
test('missing actual transaction proof fails despite a valid archive summary',()=>{
  const changed=clone();changed.receipts.pop();
  assert.throws(()=>verifyPublicTranscripts(changed,archive,deployment));
});
test('expected rejection cannot be rewritten as a successful return',()=>{
  const changed=clone();const leaders=changed.receipts.at(-1).consensus_data.leader_receipt;
  const leader=leaders.filter(r=>r.mode==='leader').at(-1);leader.execution_result='SUCCESS';leader.result={status:'return',payload:null};
  assert.throws(()=>verifyPublicTranscripts(changed,archive,deployment));
});
