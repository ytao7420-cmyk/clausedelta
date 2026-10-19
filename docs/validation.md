# Validation and reproducibility

## Current evidence boundary

The project has **32 passing Python rule/adapter tests and 33 passing JavaScript evidence/lifecycle/transcript tests**. Source snapshots were fetched from the two fixed W3C Recommendation URLs and verified locally. The actual Studionet run completed at `2026-10-19T09:42:35.718Z`: all three expected semantic outcomes, 12 successful workflow writes, and one separately verified expected rollback. A subsequent read-only transcript capture observed FINALIZED lifecycle for all 14 transactions including deployment and the expected rollback. FINALIZED does not turn the negative VM execution into success.

The Python tests use a GenLayer runtime stub, preset model replies and local official source bytes. They test ownership, immutability, evidence-span validation, intent binding, strict-source mismatch, independent-tuple disagreement, substantive-check rejection, and the relation matrix. They do not prove real LLM correctness or real consensus. The JavaScript tests verify source/citation hash rules and reject malformed or misleading transaction evidence.

## Source provenance

| Version | Source SHA-256 |
| --- | --- |
| WCAG 2.1 REC 2018-06-05 | `a8793e95937866bacd03d9b421e4e889bc7811b84d0ddec6ed8c790f8e7f67dd` |
| WCAG 2.2 REC 2023-10-05 | `9307b40f5dcd8d988444184de6d07efdf384ba744bf364bae3fd712282868508` |

`public/evidence/sources.json` records URL, byte length, capture timestamp, and file identity. Full unmodified HTML is retained under the original W3C license. `node scripts/capture-source.mjs --verify` rechecks local bytes. `npm run source` deliberately recaptures upstream data; if bytes have changed, review and create fresh requests instead of claiming an old digest still matches.

## Run offline

```sh
npm ci --ignore-scripts
npm test
npm run test:contract
node scripts/capture-source.mjs --verify
python3 scripts/extract-source.py
npm run plan
```

`npm run plan` creates no keys and sends no transactions. Inspect the exact contract SHA-256 and the three-criterion use case before the explicit deployment command below.

## Execute and inspect live

```sh
shasum -a 256 contracts/clausedelta.py
node scripts/live-test.mjs --deploy --source-sha=PASTE_REVIEWED_SHA256
node scripts/live-test.mjs --run
node scripts/export-transcripts.mjs
npm run verify
```

Use the same project folder when resuming, so `.local/` journals and keys remain available. The harness rejects changes in source, chain, actors, preset, or evidence hashes. It records broadcast intent before sending, stores transaction hashes before polling, and resumes recorded transactions without duplicate broadcasts. A connection loss with an uncertain broadcast stops automatically. Recover only after inspecting the transaction's actor, target and exact calldata; the recovery options are `--recover-label=... --recover-hash=0x...`. Deployment uncertainty requires manual provenance inspection and is never automatically retried with a new key.

Expected real-source scenarios:

1. Parsing: REMOVED, with the original full duty and explicit newer removal text.
2. Focus Visible: UNCHANGED, with both local duties and level.
3. Focus Not Obscured (Minimum): ADDED, with older full-index absence and newer duty plus qualifying notes.

Each comparison should have an immutable request, captured pair, attestation, and a separate consumer's receipt. All 12 workflow writes must have accepted/finalized lifecycle, MAJORITY_AGREE, successful VM execution, and `leaderOnly:false`. “Accepted transaction” by itself is not sufficient.

The separate negative write asks to rely on the removed Parsing criterion as UNCHANGED. It must produce an agreed VM rollback with exact payload `Outcome does not match consumer intent`, and `get_receipt(consumer,'incorrect-consumer-intent')` must return `null`. It remains an **execution error / expected rejection**, never a successful application write. Source-capture or LLM errors are not valid substitutes for this intentional semantic-intent rejection.

## Public archive checklist

After an actual run, `public/deployment.json` records contract address, exact source hash, deployment transaction and verified network. `public/evidence/demo.json` records source provenance, exact source projections, comparison/receipt digests, transaction hashes and observed consensus/execution summaries. The offline verifier recomputes hashes, source projections, exact citations, classification and caller intent bindings, and validates the expected-rejection evidence.

If any earlier attempts fail, retain their deployment/transaction provenance and describe the cause separately. Do not suppress failed attempts or call unresolved transactions successful. The harness preserves deployment history; local failed receipts can be summarized for publication without including secrets. Never publish `.local/`, keys, wallet files, cookies or access tokens.

A live run is evidence of this bounded test execution with project-controlled actors. It does not establish independent adoption, whole-standard conformance, a security audit, GenLayer Portal acceptance, points, or token rewards.

## Observed live deployment

- Network: GenLayer Studionet, chain ID `61999`.
- Contract: [`0x4Bb815B685870740B297C18DaB99A1724a0c45A9`](https://explorer-studio.genlayer.com/address/0x4Bb815B685870740B297C18DaB99A1724a0c45A9).
- Contract source SHA-256: `6af6152570388b867ab5bd2d7eb555958c3ef3bb6d0ce76c4069aace8147b3c0`.
- Deployment transaction: `0xa832e9a9104e78fd988a16a53322c33f66c6462c2f0dcd966e8b3c67458547b0`.
- Creator: `0x8F3B11c33c75a09Ca0B4F0D52964a8085199276b`.
- Consumer: `0x1A5dc1DD73a7e558ae4896cBA360510948c973c1`.
- All actors are project-controlled test wallets; none are presented as independent organizations or Portal-user wallet ownership.

| Request | Observed outcome | Semantic-attestation transaction |
| --- | --- | --- |
| parsing-removed | REMOVED | `0xaae1ed822de76894034816495b5253254f01843728c7a6c2518bc156f8bd8a2f` |
| visible-unchanged | UNCHANGED | `0x235ba578d2728c34ebf48c6fa07d14a655a914aaf5bedfc0d87188cd42f6d584` |
| not-obscured-added | ADDED | `0xad858ecaa9e01512ac863d31ee4864472b9615b8303e8f0a8bc99848bffa709c` |

The negative transaction `0x28c43616d40b6d9152d97a175aa777d09a23a31a4b8d47f45fccd3a43529050b` reached validator MAJORITY_AGREE with VM ERROR and rollback payload `Outcome does not match consumer intent`. Readback of its attempted receipt returned `null`. The workflow archive initially observed ACCEPTED for that negative transaction; the later [public transcript](../public/evidence/transcripts.json) observed FINALIZED. The positive workflows were already FINALIZED when the archive was written. All runs used `leaderOnly:false`. No unexpected on-chain failure occurred in this run. An earlier local invocation with a mismatching reviewed-source argument was rejected before a wallet or broadcast was created.

`npm run verify` additionally checks all 14 retained public RPC transcript envelopes, transaction hashes, actual callers, targets, and encoded calldata against the recorded intended calls. The full raw RPC replies are retained locally; the public evidence contains selected result fields, calldata and public addresses without keys. The three real semantic results and exact cited source spans are in [demo.json](../public/evidence/demo.json).
