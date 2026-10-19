"""Rule tests with an explicit GenLayer stub, not a chain/LLM/HTTP simulator.

Predetermined independent replies exercise equivalence and rejection paths.
These tests do not prove prompt-injection resistance, real consensus, network
rollback, source authenticity, observation accuracy or scientific suitability.
"""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest


OWNER = "0x" + "1" * 40
OTHER = "0x" + "2" * 40
SOURCE = """README GHCN-DAILY\nFORMAT OF DATA FILES\nTMAX = Maximum temperature (tenths of degrees C)\nTAVG = Average daily temperature (tenths of degrees C)\nTAXN = Average daily temperature computed as (TMAX+TMIN)/2.0\nPRCP = Precipitation (tenths of mm)\nVALUE1 missing = -9999\nQFLAG blank did not fail a check; X failed bounds check\nMFLAG T trace of precipitation snowfall snow depth\n"""
SHA = hashlib.sha256(SOURCE.encode()).hexdigest()


class UserError(Exception):
    pass


class Disagreement(Exception):
    pass


class TreeMap(dict):
    pass


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class Contract:
    def __new__(cls):
        instance = object.__new__(cls)
        for name, annotation in cls.__annotations__.items():
            setattr(instance, name, getattr(annotation, "__origin__", annotation)())
        return instance


class Runtime:
    def __init__(self):
        self.answers, self.prompts, self.fetches = [], [], []
        self.bodies = [SOURCE.encode()]
        self.url_bodies = {}
        self.status = 200
        self.override = None
        self.gl = types.SimpleNamespace(
            Contract=Contract, public=types.SimpleNamespace(view=lambda fn: fn, write=lambda fn: fn),
            message=types.SimpleNamespace(sender_address=types.SimpleNamespace(as_hex=OWNER)),
            nondet=types.SimpleNamespace(web=types.SimpleNamespace(get=self.fetch), exec_prompt=self.prompt),
            eq_principle=types.SimpleNamespace(strict_eq=self.strict),
            vm=types.SimpleNamespace(UserError=UserError, Return=Return, run_nondet_unsafe=self.run))

    def fetch(self, url, headers):
        self.fetches.append(url)
        body = self.url_bodies.get(url) or (self.bodies.pop(0) if len(self.bodies) > 1 else self.bodies[0])
        return types.SimpleNamespace(status=self.status, body=body)

    def prompt(self, prompt, response_format):
        self.prompts.append(prompt)
        if response_format != "json" or not self.answers:
            raise AssertionError("Missing independent JSON response fixture")
        return copy.deepcopy(self.answers.pop(0))

    def strict(self, fn):
        left, right = fn(), fn()
        if left != right:
            raise Disagreement("Source snapshots differ")
        return left

    def run(self, leader, validator):
        result = leader()
        if self.override is not None:
            result = copy.deepcopy(self.override)
        if not validator(Return(copy.deepcopy(result))):
            raise Disagreement("Independent semantic/citation checks disagree")
        return result

    def load(self):
        module = types.ModuleType("genlayer")
        module.__all__ = ["gl", "TreeMap"]
        module.gl, module.TreeMap = self.gl, TreeMap
        old = sys.modules.get("genlayer")
        sys.modules["genlayer"] = module
        try:
            path = Path(__file__).resolve().parents[1] / "contracts" / "clausedelta.py"
            spec = importlib.util.spec_from_file_location("clausedelta_rule_tests", path)
            contract = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(contract)
            return contract
        finally:
            if old is None:
                del sys.modules["genlayer"]
            else:
                sys.modules["genlayer"] = old


ROOT = Path(__file__).resolve().parents[1]


def semantics(old='ACTIVE', new='ACTIVE', forward='YES', backward='YES', consistency='CONSISTENT'):
    if old != 'ACTIVE' or new != 'ACTIVE':
        forward = backward = 'NOT_APPLICABLE'
    return {'old_state': old, 'new_state': new, 'old_implies_new': forward,
            'new_implies_old': backward, 'consistency': consistency, 'reason': 'Bounded source interpretation',
            'old_spans': [] if old == 'ABSENT' else [{'start': 1, 'end': 3}],
            'new_spans': [] if new == 'ABSENT' else [{'start': 1, 'end': 3}]}


class ClauseDeltaTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.module = self.runtime.load()
        self.contract = self.module.ClauseDelta()
        self.html = [(ROOT / 'public/evidence' / name).read_bytes() for name in ('wcag21.html', 'wcag22.html')]
        self.shas = [hashlib.sha256(body).hexdigest() for body in self.html]
        self.runtime.url_bodies = dict(zip(self.module.SOURCES, self.html))

    def create(self, identifier='test', criterion='focus-visible'):
        self.contract.create_request(identifier, criterion, *self.shas)

    def capture(self, identifier='test', criterion='focus-visible'):
        self.create(identifier, criterion)
        self.contract.capture_sources(identifier)

    def attest(self, reply=None, independent=None, verify=None, criterion='focus-visible', identifier='test'):
        self.capture(identifier, criterion)
        reply = reply or semantics()
        self.runtime.answers = [reply, independent or reply, verify or {k: True for k in self.module.CHECKS}]
        self.contract.attest(identifier)
        return json.loads(self.contract.get_attestation(OWNER, identifier))

    def test_official_extractor_all_three_criteria(self):
        for criterion, number in self.module.CRITERIA.items():
            for body in self.html:
                view = self.module._extract(body.decode(), criterion)
                self.assertEqual(view['section_index'], sorted(set(view['section_index'])))
                if view['section_present']:
                    self.assertIn(number, view['lines'][0])
        old = self.module._extract(self.html[0].decode(), 'focus-not-obscured-minimum')
        new = self.module._extract(self.html[1].decode(), 'focus-not-obscured-minimum')
        self.assertFalse(old['section_present'])
        self.assertTrue(new['section_present'])
        self.assertIn('not entirely hidden', ' '.join(new['lines']))

    def test_removed_section_keeps_removal_evidence(self):
        view = self.module._extract(self.html[1].decode(), 'parsing')
        self.assertTrue(view['section_present'])
        self.assertIn('Obsolete and removed', view['lines'][0])
        self.assertIn('no longer has utility and is removed.', ' '.join(view['lines']))

    def test_classifier_complete_boolean_entailment_matrix(self):
        expected = {('YES','YES'):'UNCHANGED',('YES','NO'):'WEAKENED',('NO','YES'):'STRENGTHENED',('NO','NO'):'INCOMPARABLE'}
        for a in ('YES','NO','UNKNOWN'):
            for b in ('YES','NO','UNKNOWN'):
                self.assertEqual(self.module._classification(semantics(forward=a,backward=b)), expected.get((a,b),'UNKNOWN'))

    def test_classifier_presence_matrix(self):
        states = ('ACTIVE','ABSENT','OBSOLETE','UNKNOWN')
        for old in states:
            for new in states:
                expected = 'UNKNOWN'
                if old == new == 'ACTIVE': expected = 'UNCHANGED'
                elif old == 'ACTIVE' and new in ('ABSENT','OBSOLETE'): expected = 'REMOVED'
                elif new == 'ACTIVE' and old in ('ABSENT','OBSOLETE'): expected = 'ADDED'
                self.assertEqual(self.module._classification(semantics(old,new)),expected)

    def test_conflict_and_unknown_cannot_be_weakened(self):
        for consistency in ('UNKNOWN','CONFLICTING'):
            for a in ('YES','NO','UNKNOWN'):
                for b in ('YES','NO','UNKNOWN'):
                    self.assertEqual(self.module._classification(semantics(forward=a,backward=b,consistency=consistency)), 'UNKNOWN' if consistency=='UNKNOWN' else 'CONFLICT')

    def test_capture_fetches_both_versions_independently(self):
        self.capture()
        self.assertEqual(self.runtime.fetches, list(self.module.SOURCES)*2)
        snapshot = json.loads(self.contract.get_snapshot(OWNER,'test'))
        self.assertEqual([s['raw_sha256'] for s in snapshot['sources']],self.shas)
        digest=snapshot.pop('digest');self.assertEqual(digest,self.module._hash(self.module._json(snapshot)))

    def test_cannot_rewrite_request(self):
        self.create()
        with self.assertRaisesRegex(UserError,'immutable'):self.create()

    def test_owner_namespace_isolation(self):
        self.capture()
        self.runtime.gl.message.sender_address.as_hex=OTHER
        with self.assertRaisesRegex(UserError,'not found'):self.contract.attest('test')
        self.create()
        self.assertEqual(json.loads(self.contract.get_request(OTHER,'test'))['owner'],OTHER)

    def test_cannot_replace_snapshot(self):
        self.capture()
        with self.assertRaisesRegex(UserError,'immutable'):self.contract.capture_sources('test')

    def test_capture_rejects_changed_bytes(self):
        self.create()
        self.runtime.url_bodies[self.module.SOURCES[0]]+=b' '
        with self.assertRaisesRegex(UserError,'SHA-256'):self.contract.capture_sources('test')
        self.assertEqual(self.contract.get_snapshot(OWNER,'test'),'null')

    def test_capture_requires_known_official_version(self):
        bad=self.html[0].replace(self.module.SOURCES[0].encode(),b'http://other.invalid/version/')
        self.contract.create_request('test','focus-visible',hashlib.sha256(bad).hexdigest(),self.shas[1])
        self.runtime.url_bodies[self.module.SOURCES[0]]=bad
        with self.assertRaisesRegex(UserError,'version identity'):self.contract.capture_sources('test')

    def test_unsupported_criterion_rejected(self):
        with self.assertRaisesRegex(UserError,'three-criterion'):self.create(criterion='made-up')

    def test_hash_not_arbitrary_url(self):
        with self.assertRaisesRegex(UserError,'SHA-256'):self.contract.create_request('x','parsing','https://evil.invalid',self.shas[1])

    def test_source_before_attest(self):
        self.create()
        with self.assertRaisesRegex(UserError,'Capture'):self.contract.attest('test')

    def test_independent_semantics_disagreement_rejected(self):
        with self.assertRaises(Disagreement):self.attest(independent=semantics(forward='NO'))
        self.assertEqual(self.contract.get_attestation(OWNER,'test'),'null')

    def test_unrelated_valid_span_is_not_enough(self):
        reply=semantics();reply['old_spans']=[{'start':1,'end':1}]
        checks={k:True for k in self.module.CHECKS};checks['citation_support']=False
        with self.assertRaises(Disagreement):self.attest(reply=reply,verify=checks)

    def test_cannot_fabricate_quotation(self):
        reply=semantics();reply['old_spans'][0]['quote']='A fabricated quote'
        with self.assertRaises(UserError):self.attest(reply)

    def test_citations_reconstructed_exactly(self):
        att=self.attest()
        snap=json.loads(self.contract.get_snapshot(OWNER,'test'))
        self.assertEqual(att['semantics']['old_spans'][0]['quote'],'\n'.join(snap['sources'][0]['lines'][:3]))

    def test_absent_section_cannot_receive_fabricated_citation(self):
        self.capture(criterion='focus-not-obscured-minimum')
        source=json.loads(self.contract.get_snapshot(OWNER,'test'))['sources'][0]
        with self.assertRaises(UserError):self.module._spans([{'start':1,'end':1}],source,'ABSENT')

    def test_obsolete_is_not_structurally_absent(self):
        reply=semantics(new='ABSENT')
        with self.assertRaises(UserError):self.attest(reply,criterion='parsing')

    def test_added_classification_with_empty_old_spans(self):
        reply=semantics(old='ABSENT')
        result=self.attest(reply,criterion='focus-not-obscured-minimum')
        self.assertEqual(result['outcome'],'ADDED')
        self.assertEqual(result['semantics']['old_spans'],[])

    def test_removed_requires_explicit_semantic_state(self):
        result=self.attest(semantics(new='OBSOLETE'),criterion='parsing')
        self.assertEqual(result['outcome'],'REMOVED')

    def test_no_boolean_as_span_integer(self):
        reply=semantics();reply['old_spans']=[{'start':True,'end':3}]
        with self.assertRaises(UserError):self.attest(reply)

    def test_duplicate_spans_rejected(self):
        reply=semantics();reply['old_spans']*=2
        with self.assertRaisesRegex(UserError,'Duplicate'):self.attest(reply)

    def test_active_pair_requires_entailment(self):
        reply=semantics();reply['old_implies_new']='NOT_APPLICABLE'
        with self.assertRaises(UserError):self.attest(reply)

    def test_nonactive_pair_cannot_assert_implications(self):
        reply=semantics(new='OBSOLETE');reply['old_implies_new']='YES'
        with self.assertRaises(UserError):self.attest(reply,criterion='parsing')

    def test_attestation_immutable(self):
        self.attest()
        with self.assertRaisesRegex(UserError,'immutable'):self.contract.attest('test')

    def test_consumer_receipt_binds_digest_and_outcome(self):
        att=self.attest()
        self.runtime.gl.message.sender_address.as_hex=OTHER
        self.contract.record_reliance(OWNER,'test','r',att['digest'],'UNCHANGED')
        receipt=json.loads(self.contract.get_receipt(OTHER,'r'))
        self.assertEqual(receipt['consumer'],OTHER)
        self.assertEqual(receipt['attestation_digest'],att['digest'])
        self.assertEqual(receipt['outcome'],'UNCHANGED')
        self.assertEqual(json.loads(self.contract.get_attestation(OWNER,'test')),att)
        with self.assertRaisesRegex(UserError,'immutable'):self.contract.record_reliance(OWNER,'test','r',att['digest'],'UNCHANGED')

    def test_incorrect_consumer_intent_rolls_back_before_write(self):
        att=self.attest()
        for digest,outcome,error in [('0'*64,'UNCHANGED','digest'),(att['digest'],'REMOVED','Outcome')]:
            with self.assertRaisesRegex(UserError,error):self.contract.record_reliance(OWNER,'test','bad',digest,outcome)
            self.assertEqual(self.contract.get_receipt(OWNER,'bad'),'null')

    def test_unresolved_receipt_rejected(self):
        for reply in [semantics(forward='UNKNOWN'),semantics(consistency='CONFLICTING'),semantics(forward='NO',backward='NO')]:
            self.setUp();att=self.attest(reply)
            with self.assertRaisesRegex(UserError,'Unresolved'):self.contract.record_reliance(OWNER,'test','bad',att['digest'],att['outcome'])
            self.assertEqual(self.contract.get_receipt(OWNER,'bad'),'null')

    def test_malformed_section_index_rejected(self):
        text=self.html[0].decode()
        for bad in [text+'<section id="unclosed">',text+'<section id="parsing"></section>',text+'</section>']:
            with self.assertRaises(UserError):self.module._extract(bad,'parsing')

    def test_prompt_covers_explicit_boundaries(self):
        self.attest()
        self.assertEqual(len(self.runtime.prompts),3)
        self.assertIn('criterion',self.runtime.prompts[0])
        self.assertIn('untrusted DATA',self.runtime.prompts[0])
        self.assertNotIn('Bounded source interpretation',self.runtime.prompts[2])


if __name__=='__main__':unittest.main()
