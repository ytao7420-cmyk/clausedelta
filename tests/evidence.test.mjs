import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,sha256,verifyDigest,classify,verifySpans} from '../lib/evidence.js';
const tuple=(a='YES',b='YES')=>({old_state:'ACTIVE',new_state:'ACTIVE',old_implies_new:a,new_implies_old:b,consistency:'CONSISTENT'});
test('change matrix preserves direction and indeterminate entailment',()=>{
  for(const [a,b,expected] of [['YES','YES','UNCHANGED'],['NO','YES','STRENGTHENED'],['YES','NO','WEAKENED'],['NO','NO','INCOMPARABLE'],['UNKNOWN','YES','UNKNOWN'],['YES','UNKNOWN','UNKNOWN']])assert.equal(classify(tuple(a,b)),expected);
});
test('source conflict overrides a tempting unchanged answer',()=>{
  assert.equal(classify({...tuple(),consistency:'CONFLICTING'}),'CONFLICT');
  assert.equal(classify({...tuple(),consistency:'UNKNOWN'}),'UNKNOWN');
});
test('obsolete body and absent section are distinct but both can remove a duty',()=>{
  for(const state of ['OBSOLETE','ABSENT']){
    assert.equal(classify({...tuple(),new_state:state}),'REMOVED');
    assert.equal(classify({...tuple(),old_state:state}),'ADDED');
  }
});
test('canonical hashes bind all nested fields, preserve unicode and forbid changed intent',()=>{
  const original={z:'跨版本',a:{z:1,a:[1,'2']}};
  assert.equal(canonicalJson(original),'{"a":{"a":[1,"2"],"z":1},"z":"跨版本"}');
  const record={...original,digest:sha256(canonicalJson(original))};verifyDigest(record);
  assert.throws(()=>verifyDigest({...record,a:{...record.a,z:2}}));
});
test('exact span verifier refuses invented text, coordinates and duplicate spans',()=>{
  const source={section_present:true,lines:['Title','Condition','Except X'],section_index:['criterion'],section_id:'criterion'};
  const valid={start:2,end:3,quote:'Condition\nExcept X'};
  verifySpans([valid],source,'ACTIVE');
  for(const spans of [[{...valid,quote:'Condition'}],[{...valid,start:0}],[{...valid,end:99}],[valid,valid],[]])assert.throws(()=>verifySpans(spans,source,'ACTIVE'));
});
test('absence proof requires the complete index and cannot contain manufactured spans',()=>{
  const source={section_present:false,lines:[],section_index:['other'],section_id:'criterion'};
  verifySpans([],source,'ABSENT');
  assert.throws(()=>verifySpans([],source,'ACTIVE'));
  assert.throws(()=>verifySpans([], {...source,section_index:['criterion']},'ABSENT'));
});
