import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
// All keys are ASCII; default lexical sort is used to match Python sort_keys.
export function canonicalJson(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(value[key])).join(',')+'}';
}
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function verifyDigest(value){const {digest,...rest}=value;assert.equal(digest,sha256(canonicalJson(rest)));return digest;}
export function classify(v){
  if(v.consistency==='CONFLICTING')return 'CONFLICT';
  if(v.consistency!=='CONSISTENT'||[v.old_state,v.new_state].includes('UNKNOWN'))return 'UNKNOWN';
  const inactive=['ABSENT','OBSOLETE'];
  if(inactive.includes(v.old_state)&&v.new_state==='ACTIVE')return 'ADDED';
  if(v.old_state==='ACTIVE'&&inactive.includes(v.new_state))return 'REMOVED';
  if(v.old_state!=='ACTIVE'||v.new_state!=='ACTIVE')return 'UNKNOWN';
  return {'YES:YES':'UNCHANGED','NO:YES':'STRENGTHENED','YES:NO':'WEAKENED','NO:NO':'INCOMPARABLE'}[`${v.old_implies_new}:${v.new_implies_old}`]??'UNKNOWN';
}
export function verifySpans(spans,source,state){
  assert.ok(Array.isArray(spans)&&spans.length<=5);
  const seen=new Set();
  for(const span of spans){
    assert.deepEqual(Object.keys(span).sort(),['end','quote','start']);
    assert.ok(Number.isInteger(span.start)&&Number.isInteger(span.end)&&span.start>=1&&span.end>=span.start&&span.end<=source.lines.length&&span.end-span.start<12);
    const key=`${span.start}:${span.end}`;assert.ok(!seen.has(key));seen.add(key);
    assert.equal(span.quote,source.lines.slice(span.start-1,span.end).join('\n'));
  }
  if(!source.section_present){assert.equal(state,'ABSENT');assert.equal(spans.length,0);assert.ok(!source.section_index.includes(source.section_id));}
  else{assert.notEqual(state,'ABSENT');if(state!=='UNKNOWN')assert.ok(spans.length>0);}
}
export function verifyComparison(item,fixture,expectedViews,owner,consumer){
  const {request,snapshot,attestation,receipt}=item;
  for(const value of [request,snapshot,attestation,receipt])verifyDigest(value);
  assert.equal(request.owner,owner.toLowerCase());assert.equal(request.id,fixture.id);assert.equal(request.criterion,fixture.criterion);
  assert.equal(snapshot.request_digest,request.digest);assert.deepEqual(snapshot.sources,expectedViews);
  assert.equal(request.old_sha256,expectedViews[0].raw_sha256);assert.equal(request.new_sha256,expectedViews[1].raw_sha256);
  assert.deepEqual(request.source_urls,expectedViews.map(view=>view.url));
  assert.equal(attestation.request_digest,request.digest);assert.equal(attestation.snapshot_digest,snapshot.digest);
  assert.equal(attestation.criterion,fixture.criterion);assert.equal(attestation.old_sha256,request.old_sha256);assert.equal(attestation.new_sha256,request.new_sha256);
  assert.equal(attestation.profile,request.profile);assert.equal(classify(attestation.semantics),attestation.outcome);
  assert.equal(attestation.outcome,fixture.expected);
  verifySpans(attestation.semantics.old_spans,snapshot.sources[0],attestation.semantics.old_state);
  verifySpans(attestation.semantics.new_spans,snapshot.sources[1],attestation.semantics.new_state);
  assert.equal(receipt.consumer,consumer.toLowerCase());assert.equal(receipt.request_owner,owner.toLowerCase());
  assert.equal(receipt.request_id,request.id);assert.equal(receipt.request_digest,request.digest);
  assert.equal(receipt.attestation_digest,attestation.digest);assert.equal(receipt.outcome,attestation.outcome);
  assert.equal(receipt.id,fixture.id+'-reliance');
  return true;
}
