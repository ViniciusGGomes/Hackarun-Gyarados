# Reservations and Availability verification

**Verdict**: FAIL (re-check: only F7 residual, F10 and informational items remain; see `## Re-check`)
**Proofs**: `proofs.md` at 2aa9a44; re-judged against code/tests at d439d14 (test-only commit, `reservations-routes.test.ts` run once: 44 passed)
**Verifier**: independent sub-agent (author != verifier)

Read: spec.md, tasks.md `## Checks`, proofs.md, the code and tests named in the request. The proofs were not rerun
(`proofs.md` is green) and no throwaway test was run: the own examples were traced through the code and the tests that
exist (all behaviour probed below is deterministic pure logic or a single SQL path).

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `reservations.slots.test.ts` `slots build blocks from the weekday opening hours` | yes - 21 blocks, first 13:00Z, last 23:00Z (= closeTime - loan, inclusive), each 30 min; the UTC-3 offset sign is pinned by the Z values |
| C2 | `reservations.slots.test.ts` `slots closed or missing weekday has no blocks` | yes |
| C3 | `reservations.slots.test.ts` `slots drop past blocks and keep the one in progress` | yes - now 11:10 keeps 11:00, 19 blocks; the end-equals-now boundary is pinned by the sibling test `have no blocks left after the last one has ended` (now 20:30) |
| C4 | `reservations.slots.test.ts` `slots drop dates beyond the maximum advance` | yes - today+7 kept, today+8 and yesterday dropped; local-midnight window covered by `window accepts today through ...` |
| C5 | `reservations.slots.test.ts` `free units use peak simultaneity in the loan window` | yes - the 12:00 end/start tie (peak 1 vs 2) fails if release does not sort before start |
| C6 | `reservations.slots.test.ts` `free units never go below zero` | yes |
| C7 | `reservations.slots.test.ts` `startAt outside hours is outside_hours` | yes - 09:30, 20:30 (closeTime-loan+30), closed, missing row; the inclusive 20:00 bound is in sibling `... is ok` |
| C8 | `reservations.slots.test.ts` `startAt unaligned past or beyond advance is invalid` | yes - 10:15, past, today+8; startAt exactly now is `ok` in the sibling test |
| C9 | `protocol.test.ts` `protocol matches CAP-XXXX-XXXX with the safe alphabet` | yes - length and anchored regex over 200 samples |
| C10 | `protocol.test.ts` `protocol values are unique across many calls` | yes for the generator, but see F1: the collision retry of Create AC 5 has no check |
| C11 | `error-response.test.ts` `AppError becomes its status and code` | yes - `toEqual` on the full body for 400/409/429 |
| C12 | `rate-limit.test.ts` `rate limit returns 429 after 10 requests and recovers next window` | yes - 10 ok, 11th 429 with body, 61 s later ok (exact 60 s boundary not pinned; `now >= resetAt` in code) |
| C13 | `reservations-routes.test.ts` `availability lists blocks with free units for an open day` | yes - envelope fields, 21 slots, first slot exact, every slot 6 |
| C14 | `reservations-routes.test.ts` `availability with every unit taken marks blocks unavailable` | yes for the counts; it does not assert the unmet-demand outcome of a partly free day (F3) |
| C15 | `reservations-routes.test.ts` `availability invalid type or date returns 400 VALIDATION_ERROR` | yes - bad type, bad string, 2026-02-30, missing |
| C16 | `reservations-routes.test.ts` `availability type without active equipment has no free blocks` | yes |
| C17 | `reservations-routes.test.ts` `availability closed day returns empty slots` | yes - closing weekday 2 only empties Tuesday, so a weekday off-by-one fails |
| C18 | `reservations-routes.test.ts` `availability counts reserved and picked_up but not cancelled returned or no_show` | yes (re-judged at d439d14) - one unit, each status seeded alone: reserved and picked_up leave 0, cancelled, returned and no_show leave 1 |
| C19 | `reservations-routes.test.ts` `availability nowAvailable is set only for today` | yes (re-judged at d439d14) - original test plus C56 (before opening false, last block true, after the last block false with empty slots, 02:00Z local day) |
| C20 | `reservations-routes.test.ts` `availability records unmet demand when no block is free` | yes for one call (type, requestedFor); one call only, so "no deduplication" (D6) is not held (F6) |
| C21 | `reservations-routes.test.ts` `availability does not record unmet demand outside its conditions` | yes (re-judged at d439d14) - a partly free day (6 reserved at 10:00, later blocks free) now asserts 0 rows; closed, past and beyond-window days kept |
| C22 | `reservations-routes.test.ts` `availability needs no token and exposes no personal data` | yes - phone, name, protocol absent; exact slot keys |
| C23 | `reservations-routes.test.ts` `reservation valid request returns 201 and stores request reservation consent and history` | yes - exact key set, values, all four tables, history from-null |
| C24 | `reservations-routes.test.ts` `reservation computes endAt and pickupDeadline from the settings` | yes - non-default 90/20 distinguishes start-based from default values |
| C25 | `reservations-routes.test.ts` `reservation now mode uses the current block` | yes (re-judged at d439d14) - the full-block `now` case is held by C55 |
| C26 | `reservations-routes.test.ts` `reservation invalid data returns 400 and stores nothing` | yes for the name/notes/phone-format cases (valid edges held by C54); residual: phone length is pinned only at 6 digits (invalid) and 10/11 (valid), so `{9,11}` or `{10,12}` still pass (F7 residual, low) |
| C27 | `reservations-routes.test.ts` `reservation without valid consent returns 400 CONSENT_REQUIRED` | yes - accepted false, old version, no active notice, nothing stored |
| C28 | `reservations-routes.test.ts` `reservation outside the allowed period is rejected` | yes - six cases with the documented code each, nothing stored |
| C29 | `reservations-routes.test.ts` `reservation with an unknown location or fields of the other type returns 400` | yes - unknown, inactive location, forWhom/size on stroller, strollerKind on wheelchair, plus a valid stroller control |
| C30 | `reservations-routes.test.ts` `reservation on a taken slot returns 409 SLOT_UNAVAILABLE` | yes - same block and an overlapping later block; the touching case (previous reservation ends at startAt) is only unit-level |
| C31 | `reservations-routes.test.ts` `reservation second active reservation of the phone returns 409 ACTIVE_RESERVATION_LIMIT` | yes - other type and other phone pass; limit-before-slot order is not pinned (second is at a different, free time) |
| C32 | `reservations-routes.test.ts` `reservation allowed again after the previous one is cancelled or returned` | yes |
| C33 | `reservations-routes.test.ts` `settings changes apply to new bookings and keep stored reservations` | yes for loan, slot, close time and per-phone limit; `maxAdvanceDays`, `pickupToleranceMinutes` and `quantity` changes are not exercised at route level |
| C34 | `reservations-routes.test.ts` `reservation failure leaves no orphan request` | yes - a real trigger fails the Consent insert, 500, all four tables empty, no leak of the DB message; lock release afterwards is not asserted (F8) |
| C35 | `reservations-routes.test.ts` `equipment quantity limits the reservations of a block` | yes |
| C36 | `reservations-routes.test.ts` `simultaneous reservations create exactly as many as there are free units` | yes - 8 parallel, 2 units: exactly [201,201,409 x6], all SLOT_UNAVAILABLE, 2 rows; fails (probabilistically) without the lock |
| C37 | `reservations-routes.test.ts` `simultaneous reservations from one phone create only one` | yes - 6 parallel, one row, rest ACTIVE_RESERVATION_LIMIT |
| C38 | `reservations-routes.test.ts` `simultaneous reservations of different types both succeed` | yes (re-judged at d439d14) - still only the happy parallel case on its own, but the per-type lock is now held by C50 |
| C39 | `reservations-routes.test.ts` `reservation endpoint is rate limited and availability is not` | yes - 10 invalid (400) POSTs count, 11th is 429; cancel route also 429; 15 availability calls stay 200 |
| C40 | `reservations-routes.test.ts` `cancel valid reservation returns 200 and records history` | yes - view, timeline, status, completedAt (equals the fixed NOW, which is what the fake clock is for), history row with reason |
| C41 | `reservations-routes.test.ts` `cancel frees the unit for availability and a new booking` | yes - one unit: 0 before, 1 after, a new booking passes |
| C42 | `reservations-routes.test.ts` `cancel unknown protocol wrong phone or anonymized returns the same 404` | yes (re-judged at d439d14) - the anonymized request keeps its phone and the matching phone is sent, so only the `anonymizedAt` check can produce the 404 |
| C43 | `reservations-routes.test.ts` `cancel in a final or picked up status returns 409 REQUEST_NOT_CANCELLABLE` | yes - four statuses, status and history unchanged |
| C44 | `reservations-routes.test.ts` `cancel invalid phone or reason returns 400` | yes (re-judged at d439d14) - the 200-character reason is accepted in C54; phone length bounds share the F7 residual |
| C45 | `reservations-routes.test.ts` `cancel and pickup at the same time apply one transition` | yes, probabilistic (re-judged at d439d14) - 8 rounds; the coordinator reports an unconditional-update mutation fails it; the interleaving is still not forced, so it detects the bug by chance, not by construction (low) |
| C46 | `reservations-routes.test.ts` `cancel of a request that is not a reservation returns 409` | yes |
| C47 | `reservations-routes.test.ts` `cancel view exposes only public fields without a token` | yes - exact key set, phone, e-mail and name absent |
| C48 | `reservations-routes.test.ts` `availability still answers when recording the unmet demand fails` | yes - a trigger makes the insert fail; asserts 200, 21 slots, the error logged, 0 rows; removing the try/catch gives 500 |
| C49 | `reservations-routes.test.ts` `reservation retries the protocol after a collision` | yes - `generateProtocol` forced once to an existing protocol; asserts 201, a different well-formed protocol, one reservation; without the retry loop the insert fails |
| C50 | `reservations-routes.test.ts` `booking lock is per type and availability takes no lock` | yes - another transaction holds `hashtext('equipment:wheelchair')`: stroller booking and availability complete, a wheelchair booking stays pending 400 ms, then succeeds on release; a global key hangs the stroller call, no lock leaves the wheelchair call done |
| C51 | `reservations-routes.test.ts` `equipment reduction keeps stored reservations and limits new ones` | yes - existing row kept, availability 0 with the new total of 1, new booking 409 SLOT_UNAVAILABLE |
| C52 | `reservations-routes.test.ts` `advance window setting applies to bookings and availability` | yes - with 2 days: today+1 books, today+4 is 400 VALIDATION_ERROR, availability empty at today+4 and non-empty at today+2 (inclusive bound) |
| C53 | `reservations-routes.test.ts` `reservation failure log holds no personal data` | yes - forced 500, `console.error` called, name, phone and e-mail absent from the logged messages (message text only; nested Prisma meta is not stringified, low) |
| C54 | `reservations-routes.test.ts` `reservation accepts values at the documented limits` | yes - name 120, notes 200, 10- and 11-digit phones give 201, a 200-character reason gives 200; the invalid side is in C26/C44 |
| C55 | `reservations-routes.test.ts` `reservation now mode needs a free unit in the current block` | yes - six reservations in the current block: 409 SLOT_UNAVAILABLE, nothing new stored |
| C56 | `reservations-routes.test.ts` `availability nowAvailable follows the opening hours and the local day` | yes - 09:00 false, 20:10 (last block) true, 21:30 empty slots and false, 02:00Z is still Monday so Tuesday is null and Monday is false |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1 Create AC 5 "SHALL generate another one if the value collides" has no check | `reservations.repository.ts:131-134` loops while `findUnique` finds the protocol; C9/C10 test only the generator; no test seeds a request with a protocol the generator is forced to return first | add a check that makes the first generated protocol collide with an existing request (mock `generateProtocol` once) and asserts 201 with a different protocol | d439d14 |
| F2 Create AC 4 "now ... only if it has a free unit" untested | C25 books `mode: 'now'` only on an empty block; the full-block `now` booking is never posted | extend C25 (or add a check): fill the current block, post `mode: 'now'`, assert 409 `SLOT_UNAVAILABLE` and nothing stored | d439d14 |
| F3 Unmet-demand condition "no block free" is not pinned on a partly free day | C20 uses a type with no active equipment; C21 asserts 0 rows only when every block is free; C14 (some blocks free, some not) never reads `unmet_demands`, so a condition like `slots.some(s => !s.available)` passes | in C21 add the C14 scenario and assert 0 rows; in C20 also exhaust all blocks by reservations (spec Independent Test) | d439d14 |
| F4 Edge cases of `nowAvailable` (AC 8) untested | C19 covers only now inside an in-progress block; not asserted: now before opening (code gives `false`; a version reading `slots[0]` gives `true`), now in the last block 20:00-20:30, now after the last block, and a local-midnight now (2026-11-17T01:30Z is Monday 22:30: date Monday -> boolean, Tuesday -> null) | add those four instants to C19 | d439d14 |
| F5 C18 asserts a sum, not which statuses count | `reservations-routes.test.ts:179` `toBe(4)` with all five statuses at the same slot | seed each status in its own non-overlapping window (or assert per status) so each of the five statuses is individually held | d439d14 |
| F6 D6 "no deduplication" and `UnmetDemand` consultation time not held | C20 consults once and never asserts `createdAt`; a dedupe-per-day mutation passes | consult the exhausted day twice, assert 2 rows and a recent `createdAt` | d439d14 |
| F7 Validation limits are only tested on the invalid side (C26, C44) | name 121, notes 201, reason 201, phone `639999`/`abc`; valid 120, 200 and a 10-digit phone are never posted (C23 posts an 11-digit phone only), so `max(119)`, `{11}` or `max(199)` pass | add 120-char name, 200-char notes, 200-char reason and a 10-digit phone as 201/200 cases; add a 12-digit phone as 400 | cae6ef7 |
| F8 Concurrency AC 3 and AC 4/5 have no discriminating check | C38 passes with a single global lock key; nothing asserts the lock key is per type (`hashtext('equipment:<type>')`), that availability takes no lock, or that the lock is gone after the C34 rollback | hold `pg_advisory_xact_lock(hashtext('equipment:wheelchair'))` in a `testPrisma` transaction and assert a stroller booking and an availability call finish while a wheelchair booking waits; after C34's failure assert a following booking succeeds | d439d14 |
| F9 Anonymized-request 404 not isolated in C42 | the test sets `anonymizedAt` and `visitorPhone: null`; the phone in the request never equals null, so the 404 comes from the phone check | in C42 keep `visitorPhone` set (matching) and set only `anonymizedAt`, and assert 404 | d439d14 |
| F10 C45 cannot fail reliably | the race is two parallel calls, 4 rounds, with no interleaving control; an unconditional `update` in `cancelReservationTx` would only fail when pickup wins before cancel's update, which the read-first ordering rarely allows | force the interleaving (hold a row lock on the request from `testPrisma`, start cancel, run the pickup update, release) or run many rounds and assert on the pickup-wins branch explicitly | d439d14 |
| F11 Edge cases from the spec with no check | (a) equipment `quantity` reduced / row deactivated while reservations exist (Edge Case) - existing kept, new total for new bookings; (b) double click on the same payload -> second gets `ACTIVE_RESERVATION_LIMIT` even when it would also be `SLOT_UNAVAILABLE` (limit is evaluated first; C31 uses a different, free time); (c) `maxAdvanceDays`/`pickupToleranceMinutes` changes (T17) at route level | add one check for each, or record them as deliberately unproven | cae6ef7 |
| F12 Spec AC "Demand AC 3: failure recording `UnmetDemand` still returns the availability" has no check | `reservations.service.ts:64-71` try/catch; no test makes `recordUnmetDemand` fail (grep of the tests finds no such case); the Success Criteria also list it | add a check that makes the insert fail (e.g. a trigger on `unmet_demands` as in C34) and asserts 200 with the slots | d439d14 |
| F13 Logs rule (Security: no phone, e-mail or name in error logs) has no check | `error-handler.ts:61` `console.error(error)` logs the whole error, and a Prisma failure during `request.create` can carry the input data; C34 mocks `console.error` and never inspects it | assert in C34 that the logged value contains no phone/e-mail/name, or log only `error.message`/code | d439d14 |
| F14 Spec tension, informational: in-progress block is listed `available` but a `scheduled` booking of it returns 400 | `validateStartAt` rejects `startAt < now` (`reservations.slots.ts:138`) while `buildBlocks`/availability keep the in-progress block (D2); BR6 says "only a block the consultation would offer" | decide: only `mode: now` may book the in-progress block (document it, then no code change), or list it with `available: false` for `scheduled` | 2035938 |
| F15 Cancelling a reservation whose `pickupDeadline` already passed is allowed and untested | `cancelReservationTx` only checks `status = reserved`; the spec is silent (RF19 no_show job is another feature) | confirm intended; add a check if it must stay allowed | 2035938 |

## Re-check at d439d14

Only `reservations-routes.test.ts` changed (no production code). Status per finding; the `Closed` column is left for the author's commit.

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 | closed in substance | C49 |
| F2 | closed in substance | C55 |
| F3 | closed in substance | C21 partly free day |
| F4 | closed in substance | C56 |
| F5 | closed in substance | C18 per status with one unit |
| F6 | closed in substance | C20 second consultation gives 2 rows; consultation time is the DB default `createdAt` (accepted, not asserted) |
| F7 | mostly closed | C54 pins 120/200/10/11/200; residual low: 9-digit and 12-digit phones are never posted, so a widened phone regex passes |
| F8 | closed in substance | C50 (per-type key, no lock in availability) and C34 now asserts the next booking succeeds after the rollback |
| F9 | closed in substance | C42 keeps the phone |
| F10 | closed with a caveat | 8 rounds, mutation reported failing; still not a forced interleaving |
| F11 | closed in substance | (a) C51, (c) C52; (b) double click on the same payload is still not posted (limit-before-slot order unpinned), low |
| F12 | closed in substance | C48 |
| F13 | closed in substance | C53 |
| F14 | accepted | D2 approved by the user; reported as a spec question, does not block |
| F15 | accepted | spec silent; the job of RF19 is another feature, does not block |
