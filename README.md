# ClauseDelta

A reusable GenLayer contract for evidence-bound comparison of a named normative criterion across two official specification versions. A requester freezes source hashes; validators fetch the exact documents and independently interpret the requirement. Deterministic code classifies the relation and lets another caller create an immutable receipt bound to the agreed result.

**Current status:** deployed and verified on GenLayer Studionet. The three real-source comparisons produced REMOVED, UNCHANGED and ADDED; 12 workflow writes plus deployment succeeded, and a separate consumer-intent mismatch produced the exact expected rollback. All 14 transaction lifecycles were FINALIZED when the public transcripts were captured. Local tests: 32 Python + 33 JavaScript. See [the deployed contract](https://explorer-studio.genlayer.com/address/0x4Bb815B685870740B297C18DaB99A1724a0c45A9) and [validation evidence](docs/validation.md). The project is not a WCAG conformance checker, a legal analysis service, or a website accessibility audit.

## Why this needs GenLayer

A string diff cannot tell whether a section still present in a new document has been expressly made obsolete. Nor can it establish whether different conditions create a stronger requirement. ClauseDelta separates semantic interpretation from outcome derivation: validators judge original evidence and both implication directions, then ordinary code computes the label. The resulting immutable record can be consumed by migration trackers, standards watchlists and requirement registries without trusting the submitting user's preferred label.

## Bounded v1 adapter

The two fixed source versions are [WCAG 2.1, 5 June 2018](https://www.w3.org/TR/2018/REC-WCAG21-20180605/) and [WCAG 2.2, 5 October 2023](https://www.w3.org/TR/2023/REC-WCAG22-20231005/). Version drift is never silently accepted: the request commits both SHA-256 hashes before validators fetch the sources.

| Selected criterion | Evidence scenario for the harness |
| --- | --- |
| 4.1.1 Parsing | Active in the older version; explicitly obsolete/removed in the newer version despite a retained section |
| 2.4.7 Focus Visible | Same local criterion-level duty and level |
| 2.4.11 Focus Not Obscured (Minimum) | Exact section ID absent in the older full section index; active duty and exceptions in the newer version |

These are **expected test outcomes**, not claims that a live GenLayer execution has already reached consensus. Only these three criterion IDs are supported. Other criteria are rejected. Comparisons concern the selected criterion as locally written, including its level and local exceptions/notes. They do not establish the global effect of linked definitions, other criteria, later errata, local law, or whole-standard conformance. Missing context must remain UNKNOWN.

## Reproduce offline

Requires Node 22+ and Python 3.9+; tested locally with Node 24.19.0 and Python 3.9.6. `genlayer-js` is pinned to **1.1.8**, with its lockfile. Contract header pins `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.

```sh
npm ci --ignore-scripts
npm test
npm run test:contract
node scripts/capture-source.mjs --verify
python3 scripts/extract-source.py
npm run plan
```

The Python tests use an explicit runtime stub and predetermined independent replies. They test deterministic invariants, negative paths, and the use of separate validator checks; they do not simulate real model behavior, network consensus, execution rollback, or prompt-injection resistance. The SDK receipt tests keep lifecycle acceptance, validator agreement, VM execution, and expected failure distinct.

## Explicit live workflow

Read [validation.md](docs/validation.md) before any broadcast. `--plan` is the default and creates no wallet. Keys are created only when deploying/running, under `.local/` with private file permissions, and are never included in public evidence. All live calls use GenLayer **Studionet 61999**, zero native value and `leaderOnly:false`. No personal wallet or mainnet network is accessed.

```sh
shasum -a 256 contracts/clausedelta.py
node scripts/live-test.mjs --deploy --source-sha=PASTE_REVIEWED_SHA256
node scripts/live-test.mjs --run
node scripts/export-transcripts.mjs
npm run verify
```

The workflow creates three requests, freezes six source projections, attests three comparisons, and records three independent-consumer receipts. A separate negative write intentionally asks to rely on a REMOVED criterion as UNCHANGED. The harness requires the exact agreed rollback and verifies that no receipt exists. These total 12 successful workflow writes and 1 expected-rejection write, plus deployment.

A journal persists intent before every broadcast and its hash before polling. Rerunning with the same configuration resumes known transactions rather than sending duplicates. An uncertain broadcast is stopped for explicit hash recovery. Earlier failed receipts stay under `.local/` and must be disclosed when preparing a public validation archive; they must not be relabeled as success.

See [API](docs/api.md), [architecture](docs/architecture.md), [validation](docs/validation.md), and the [submission draft](docs/submission-draft.md). Original project code uses MIT; W3C snapshots retain their original notices and document-use license, described in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
