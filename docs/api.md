# ClauseDelta public API

All view results are canonical JSON strings. Parse them once. Addresses are normalized to lowercase; IDs contain 1–48 ASCII letters, digits, `_` or `-`.

| Method | Arguments | Result |
| --- | --- | --- |
| `create_request` | `request_id, criterion, old_sha256, new_sha256` | Immutable caller-owned intent |
| `capture_sources` | `request_id` | Independent fixed-URL snapshot capture; stores projections after strict equality |
| `attest` | `request_id` | Independent semantic tuple and citation validation; deterministic relation |
| `record_reliance` | `owner, request_id, receipt_id, expected_digest, expected_outcome` | Immutable caller-owned consumer receipt |
| `get_request` | `owner, request_id` | Intent; missing request reverts |
| `get_snapshot` | `owner, request_id` | Captured source pair or `null` |
| `get_attestation` | `owner, request_id` | Result or `null` |
| `get_receipt` | `consumer, receipt_id` | Consumer receipt or `null` |

Supported criteria: `parsing`, `focus-visible`, `focus-not-obscured-minimum`. Both source hashes must be lowercase 64-character SHA-256. The fixed version URLs and adapter profile are part of the intent digest.

A consumer reads an attestation and explicitly binds it rather than trusting a text label copied by a frontend:

```js
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
const client = createClient({chain: studionet});
const record = JSON.parse(await client.readContract({
  address: deployedAddress,
  functionName: 'get_attestation',
  args: [requestOwner, 'visible-unchanged'],
}));
if (!record) throw new Error('No attestation yet');
// A signing client may record_reliance with the exact record.digest/outcome.
// Read-only retrieval is not itself a transaction or proof of a live execution.
```

Digests use SHA-256 of UTF-8 canonical JSON: keys sorted lexicographically, compact separators, Unicode preserved, integers exact. Every record excludes its own `digest` field when hashing. Spans contain `start,end,quote`; quote is reconstructed from `snapshot.sources[i].lines.slice(start-1,end).join('\n')`.

The [live harness](../scripts/live-test.mjs) is the complete runnable SDK example. All signing clients are auxiliary Studionet test actors. `.local/` keys must never enter the public repository or any contribution evidence.
