"""Offline deterministic projection. No LLM, HTTP, wallet, or chain execution.

Loads the pinned project's pure adapter functions with a no-op GenLayer import
shim. This verifies reproducibility of byte-to-view extraction, not consensus.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import types

ROOT = Path(__file__).resolve().parents[1]
class OfflineError(Exception): pass
module = types.ModuleType('genlayer')
module.__all__ = ['gl', 'TreeMap']
module.TreeMap = dict
module.gl = types.SimpleNamespace(Contract=object, public=types.SimpleNamespace(view=lambda f:f,write=lambda f:f), vm=types.SimpleNamespace(UserError=OfflineError))
sys.modules['genlayer'] = module
spec = importlib.util.spec_from_file_location('clausedelta_projection', ROOT / 'contracts/clausedelta.py')
contract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract)
metadata = json.loads((ROOT / 'public/evidence/sources.json').read_text())['sources']
result = {}
for criterion in contract.CRITERIA:
    views = []
    for source in metadata:
        data = (ROOT / 'public/evidence' / source['file']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == source['sha256']
        view = contract._extract(data.decode('utf-8'), criterion)
        view.update({'url': source['url'], 'raw_sha256': source['sha256'], 'raw_bytes': len(data)})
        view['digest'] = contract._hash(contract._json(view))
        views.append(view)
    result[criterion] = views
print(json.dumps(result, sort_keys=True, ensure_ascii=False, separators=(',', ':')))
