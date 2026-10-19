# Architecture and trust boundaries

## Protocol

`create_request → capture_sources → attest → record_reliance`

A request belongs to its creator's address namespace. Its ID, selected criterion, version URLs, source hashes, adapter profile and digest never change. A captured source pair and its attestation can each be written only once. Consumer receipts use the consumer's separate address namespace; consumers must name both the expected attestation digest and expected outcome. A stale/wrong digest or wrong label is rejected before state is written.

## Evidence capture

The contract fetches only two hardcoded HTTPS W3C Recommendation URLs. A request cannot redirect it to arbitrary URLs. Each response must be UTF-8, 100,000–900,000 bytes, identify its fixed version, and match the precommitted raw-byte SHA-256. `gl.eq_principle.strict_eq` runs the capture independently and compares the resulting source projections. The entire source hashes are retained, while only the relevant bounded projection and complete section-ID index are stored on chain.

The adapter indexes every `<section>` ID in the complete document; it rejects duplicate IDs, unbalanced section tags, suspicious total section counts and criterion-number mismatches. Exact ID absence is supported by the complete index, **not** by failing to find a sentence in a truncated excerpt. This proves absence of this ID only, not absence of equivalent obligations elsewhere.

Canonical text projection removes HTML markup, script/style elements and links to informative Understanding/How-to-Meet pages. Structural block tags produce line breaks; physical source newlines remain boundaries. HTML entities are decoded, whitespace within each line is collapsed, empty lines and permalink markers are removed. Headings, level, normative duty, exception text and notes stay. Citations are inclusive 1-based canonical line spans, not raw HTML line numbers and not model-written quotations. The contract reconstructs the exact cited text. Every source projection and derived record has its own canonical-JSON SHA-256 digest.

The adapter deliberately has only three supported IDs. It is not an arbitrary HTML parser for untrusted sites and does not generalize a structural absence into a global normative absence. A complete offline reproduction of the projection is provided by `scripts/extract-source.py` using the project's pure adapter functions.

## Semantic consensus

The leader proposes five bounded fields:

- old and new status: ACTIVE, OBSOLETE, ABSENT, UNKNOWN;
- old-implies-new and new-implies-old: YES, NO, UNKNOWN, NOT_APPLICABLE;
- evidence consistency: CONSISTENT, CONFLICTING, UNKNOWN.

Every validating execution independently extracts its own tuple from the same frozen original text without seeing the leader explanation. The candidate tuple must equal that independent tuple. A separate prompt must then substantively verify presence, scope, both implications, consistency, and actual citation support. Syntactically valid line coordinates alone are insufficient. Exceptions/conditions cannot be silently dropped. Source data and model explanations are treated as data, never instructions.

Source-capture strict equality and semantic custom validation solve different problems. They do not make the model infallible: correlated interpretation errors remain possible, and the accepted result is an attestation of bounded validator agreement, not objective universal truth. Offline tests cannot establish resistance to every prompt injection or genuine semantic correctness. The leader's reason remains explicitly labeled leader-authored; the semantic tuple and citations are the validated portion.

## Deterministic relation algebra

| Conditions | Outcome |
| --- | --- |
| Conflicting evidence | CONFLICT |
| Unknown evidence or local requirement state | UNKNOWN |
| Older inactive/absent → newer active | ADDED |
| Older active → newer inactive/absent | REMOVED |
| Active pair; both implications YES | UNCHANGED |
| Active pair; old→new NO, new→old YES | STRENGTHENED |
| Active pair; old→new YES, new→old NO | WEAKENED |
| Active pair; both implications NO | INCOMPARABLE |
| Any unresolved implication or neither requirement active | UNKNOWN |

INCOMPARABLE is deliberately separate from CONFLICT: neither duty implying the other does not mean they contradict each other. UNKNOWN, CONFLICT and INCOMPARABLE may be inspected through views but cannot generate reliance receipts. Strengthening/weakening/incomparability are exercised with explicit synthetic rule fixtures; the provided real-world live harness targets added, removed and unchanged examples only.

## Consumer meaning

A reliance receipt records that a caller selected a specific immutable attestation and agreed label. It has no transfer, payout, escrow, external callback, hidden owner privilege or claim that an actual implementation meets any criterion. Public evidence actors are self-controlled auxiliary test wallets. They demonstrate namespace separation, not independent organizations or real adoption.
