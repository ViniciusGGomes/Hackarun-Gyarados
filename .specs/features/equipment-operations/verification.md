# Equipment operations verification

**Verdict**: PASS (every finding is held at 08d7d21; the Closed column is filled by the fixer; residual notes in Round 3)
**Proofs**: `proofs.md` at 08d7d21 (round 3; round 1 judged 66d6a64, round 2 621dc48)
**Verifier**: independent sub-agent (author != verifier)

Files: `R` = `apps/api/src/http/equipment-operations-routes.test.ts`, `L` = `apps/api/src/modules/equipment-operations/equipment-operations.logic.test.ts`, `J` = `apps/api/src/jobs/mark-no-show.test.ts`.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `R` `agenda returns the slots of the day in ascending order` | yes - 21 slots, first start, sorted (own-slot position is not asserted) |
| C2 | `R` `agenda slots carry units and reservations with their fields` | yes - exact keys and exact reservation object |
| C3 | `R` `agenda totals and free units count only reserved and picked up reservations` | yes - 6 total (inactive excluded), 3 free, 11:30 vs 12:00 loan edge; the peak itself is C62 |
| C4 | `R` `agenda lists reservations of every status` | yes |
| C5 | `R` `agenda of a closed day or a day without opening hours has no slots` | yes - both cases |
| C6 | `R` `agenda accepts past dates and dates beyond the advance limit` | yes |
| C7 | `R` `agenda lists a reservation that starts outside the current blocks in its own slot` | yes - 22 slots, own start/end, block empty |
| C8 | `L` `overdue flags follow status and the clock at the exact limits` | yes - at the limit, +1 ms, every other status (unit level, as the matrix says) |
| C9 | `R` `agenda carries no contact data` | yes |
| C10 | `R` `agenda rejects a missing or invalid date and equipment type` | yes - six inputs, 400 and code |
| C11 | `R` `pickup inside the window returns 200 with picked_up and the server time` | yes |
| C12 | `R` `pickup stores the status the times the document and the notes with one history row` | yes - round 2: the creation row has an explicit `createdAt` (NOW - 60 min); the whole suite with NOW moved to 2026-11-03 passes (50/50) |
| C13 | `R` `pickup ignores time status and user sent in the body` | yes |
| C14 | `R` `pickup of a reservation in another status returns 409` | yes - window is open, so only the status can cause the 409 |
| C15 | `R` `pickup before the block start and after the deadline returns 409` | yes - deadline + 1 ms; start side is 55 min (exact start is C16) |
| C16 | `R` `pickup at the exact start and at the exact deadline is accepted` | yes |
| C17 | `R` `pickup requires the document when the setting asks for it` | yes |
| C18 | `R` `pickup accepts the document absent or false when it is not required` | yes - stored value checked; only the absent body without a JSON content-type |
| C19 | `R` `pickup rejects invalid notes and document values` | yes - 301 rejected, 300 accepted |
| C20 | `R` `pickup answers 400 for a malformed id and 404 for unknown other-type or anonymized` | yes |
| C21 | `R` `pickup uses the stored deadline and not the current tolerance setting` | yes - both directions |
| C22 | `R` `return of a picked up reservation returns 200 with returned and the server time` | yes |
| C23 | `R` `return stores status times notes completedAt and one history row` | yes - round 2: the creation row has an explicit `createdAt` (NOW - 60 min); the whole suite with NOW moved to 2026-11-03 passes (50/50) |
| C24 | `R` `return frees the unit in the agenda and in the public availability` | yes - 0 then 1 in both |
| C25 | `R` `late return is accepted without penalty` | yes |
| C26 | `R` `return of a reservation in another status returns 409` | yes |
| C27 | `R` `return rejects conditionNotes above 300` | yes - 301 rejected, 300 accepted |
| C28 | `R` `return answers 400 for a malformed id and 404 for unknown other-type or anonymized` | yes - no `lost_report` id (covered in the pickup test, same helper; probed below, 404) |
| C29 | `R` `the three routes answer 401 without a valid token` | yes - round 2: adds a token with a past `exp` (valid session) beside no token, garbage, wrong secret and revoked session |
| C30 | `R` `the three routes answer 403 when the user lacks the ability` | yes - `can` false for every action (all three routes 403, nothing changed); the per-route wiring is C56 |
| C31 | `R` `attendant and manager can use the three routes` | yes |
| C32 | `R` `the role is read from the database on each request` | yes - role argument per request follows the DB, not the token claim |
| C33 | `R` `simultaneous pickups of one reservation apply only one` | yes - 6 parallel, 3 rounds, exact codes and one history row |
| C34 | `R` `simultaneous returns of one reservation apply only one` | yes |
| C35 | `R` `pickup and public cancellation at the same time apply one transition` | yes - both outcomes accepted, each checked with the loser's code |
| C36 | `R` `pickup and no-show run at the same time apply one transition` | yes |
| C37 | `R` `failure inside a status change rolls back status and history together` | yes - trigger on history, both routes, 500, nothing left |
| C38 | `R` `history rows hold previous and new status time actor type and user` | yes - round 2: the creation row has an explicit `createdAt` (NOW - 60 min); the whole suite with NOW moved to 2026-11-03 passes (50/50) |
| C39 | `J` `no-show history has system actor and no user` | yes - round 2: explicit creation `createdAt`; the job file with NOW moved to 2026-11-03 passes (11/11) |
| C40 | `R` `detail history is ascending with actor type user id and name` | yes - round 2: the creation row has an explicit `createdAt` (NOW - 60 min); the whole suite with NOW moved to 2026-11-03 passes (50/50) |
| C41 | `R` `public tracking view never exposes history actors or internal notes` | yes - `POST /tracking/{protocol}/cancel` is the only public route (no GET tracking exists) |
| C42 | `J` `no-show marks a reserved reservation past its deadline` | yes - round 2: explicit creation `createdAt`; the job file with NOW moved to 2026-11-03 passes (11/11) |
| C43 | `J` `no-show leaves reservations within the tolerance untouched` | yes - deadline = now, now + 1 ms, later block |
| C44 | `J` `no-show ignores cancelled picked up returned and already no-show reservations` | yes - their deadlines are past, so only the status filter protects them |
| C45 | `J` `no-show run twice affects nothing the second time` | yes |
| C46 | `J` `simultaneous no-show runs mark each reservation once` | yes - 4 parallel runs, 6 rows, one history each |
| C47 | `J` `no-show frees the unit in the public availability` | yes |
| C48 | `J` `failed no-show run changes nothing and logs the failure without personal data` | yes |
| C49 | `J` `no-show routine has no public endpoint` | yes |
| C50 | `R` `pickup response carries visitor reservation and history` | yes - round 2: the creation row has an explicit `createdAt` (NOW - 60 min); the whole suite with NOW moved to 2026-11-03 passes (50/50) |
| C51 | `R` `detail of a reservation has null lost report sac message and no messages` | yes |
| C52 | `R` `detail carries no credentials or data of other visitors` | yes |
| C53 | `J` `job log is written only when reservations were affected or the run failed` | yes |
| C54 | `J` `job runner skips an overlapping run` | yes |
| C55 | `R` `invalid input is answered 401 without a token and 403 without the ability` | yes - round 3: four bad inputs on the three routes, 401 with no token and 403 with no ability, now through `onRequest`; the malformed body is C64 |
| C56 | `R` `each route is wired to its own ability` | yes - each of read, pickup, return granted alone: the other two routes must answer 403; a mis-wired route fails |
| C57 | `R` `agenda shows an anonymized reservation without the visitor name` | yes - the name is still stored, the body must not contain it |
| C58 | `R` `agenda of a type without active equipment has zero units` | yes - 21 slots all 0/0, the reservation still listed |
| C59 | `R` `agenda keeps other days and other equipment types out` | yes - exact id lists for both types, stroller totalUnits 7 |
| C60 | `R` `agenda overdue flags are set for late pickups and returns` | yes - route level, three cases; exact limits stay in C8 |
| C61 | `R` `pickup and return with a malformed JSON body return 400 and an empty object is accepted` | yes - malformed JSON on both routes answers 400 `VALIDATION_ERROR` through the new parser, nothing changed, `{}` gives 200 |
| C62 | `R` `agenda free units use the peak and not the count of reservations` | yes - 10:00 reserved and 12:00 picked_up never overlap: free 5 (a count would give 4) at 11:30 and 10:00 |
| C63 | `R` `pickup and return accept an empty body even with a JSON content type` | yes - both routes, `''` with `content-type: application/json`, 200 and the stored status checked |
| C64 | `R` `a malformed or empty JSON body is answered 401 without a token and 403 without the ability` | yes - four bodies (`{bad`, truncated object, truncated array, empty) x two routes, 401 and 403; status unchanged |
| C65 | `R` `a JSON body with an unsafe key is read as plain data and cannot change the result` | yes - `__proto__`/`constructor` with `notes: ok` gives 200, `Object.prototype` is not polluted, `pickupNotes` is `ok`; does not show that the keys cannot satisfy a required document (probed below) |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Invalid input without a token or with a user lacking the ability gets `400`, not `401`/`403` (Fastify validation runs before the `preHandler` that authenticates and authorizes). The spec flow says `401/403 -> 400`, and EQP-10 says no token gives `401` on the three routes. A caller without a token can probe validation and `404`-free shapes of the admin routes. No check has an invalid input and a bad token together. | Throwaway test at HEAD: no token, `GET /admin/agenda?date=bad&equipmentType=x` gives 400; no token, pickup with `not-a-uuid` gives 400; no token, pickup/return with a 301-char note gives 400; a user whose `can` is false gets 400 on the agenda with an invalid date and on a pickup with a 301-char note. `equipment-operations.routes.ts` puts `authorize` in `preHandler`, and `auth.ts` resolves the session there too. | Authenticate and authorize in `onRequest`/`preValidation` (or run `authorize` in `preValidation`) so 401/403 precede validation; add a check for 401 and 403 with an invalid query/param/body on the three routes. | 621dc48 and 08d7d21 - C55, C64 |
| Time bomb in ten checks: the creation history row gets the real clock (`@default(now())` in Postgres/Prisma, not faked), while the operation row gets the fake `NOW` (2026-11-17). The tests read `history[n]` ordered by `createdAt`, so they pass only while the real date is before `NOW`. After 2026-11-17 13:05Z (13:20Z for the job file) the creation row sorts last and C12, C23, C38, C40, C50 (routes) and C39, C42 (job) fail. The mapper has the same order (`createdAt`). | Same suite with `NOW` moved to 2026-11-10 (past): 5 of the routes tests fail (`pickup stores...`, `pickup response carries...`, `return stores...`, `history rows hold...`, `detail history is ascending...`) and the job file fails `no-show marks...` and `no-show history has system actor...`. Real date today: 2026-11-14, and the seeded creation row had `createdAt` 2026-11-14T13:00Z next to a `no_show` row at 2026-11-17T13:05Z. | Fix the fake `NOW` far in the future (for example 2035) or seed the creation history with an explicit `createdAt` before `NOW`; select history rows by `toStatus`, not by index. | 621dc48 - C12, C23, C38, C39, C40, C42, C50 |
| An empty body sent with `content-type: application/json` is rejected: Fastify answers 400 (`Body is not valid JSON but content-type is set to 'application/json'`/empty body). The spec says the pickup and return body is optional and an empty body is accepted when the document is not required. C18 only tests a request with no body and no content-type. A client that sets the JSON header on every POST (fetch/axios wrappers) cannot pickup or return without sending `{}`. | Throwaway: `POST /admin/reservations/{id}/return` with `content-type: application/json` and payload `''` gives 400; `{}` gives 200; body absent gives 200. | Register a JSON parser that treats an empty body as `{}`/null for these routes, and add a check for an empty body with the JSON content type on pickup and return. | 08d7d21 - C63 (spec edge case restored) |
| Spec criteria with no check: the Edge Cases `anonymized reservation shows in the agenda without personal data (name null)`, `equipment type with no active equipment returns totalUnits and freeUnits 0`, and `body not JSON or malformed answers 400 VALIDATION_ERROR`; and T2's filters (another day and another equipment type must not appear in the agenda). Behaviour is correct today (probes below), but a regression would pass every check. | Probes at HEAD: anonymized reservation lists `visitorName: null`; with no active wheelchair, 21 slots with `totalUnits 0`, `freeUnits 0`; malformed JSON gives `400 VALIDATION_ERROR`; a stroller reservation, one on the day before, and one on the day after are absent from the wheelchair agenda (only the 20:00 one of that day appears), and the stroller agenda shows only the stroller reservation with `totalUnits 7`. | Add checks (new criterion IDs or the existing EQP-01/02/11 for the edge cases) with tests for these cases. | 621dc48 - C57, C58, C59, C60 |
| C29 does not include the expired token the criterion names (EQP-10: "an expired token"); only no token, garbage, wrong secret and revoked session. | `R` `the three routes answer 401 without a valid token` list of cases. | Add a token signed with a past `exp` to the loop. | 621dc48 - C29 |
| C30 uses `can: () => false` for every action, so the test passes even if a route were wired to another ability (for example `pickup` guarded by `read`). | `R` `the three routes answer 403 when the user lacks the ability`, mock `{ can: () => false }`. | Mock `can` per action (true for the two other abilities, false for the route's own) and assert 403 on that route only. | 621dc48 - C56 |
| C3 puts all six reservations in the same block, so "peak of simultaneous reservations" cannot be told from "count of reservations". | `R` `agenda totals and free units count only reserved and picked up reservations`: every `seedReservation` is at 10:00. | Seed non-overlapping and partly overlapping reservations (for example 10:00, 11:30, 12:00) and assert the peak. | 621dc48 - C62 |
| Round 2: an invalid body still wins over the token. The access hook is now `preValidation`, but Fastify parses the body before it, so a malformed or empty JSON body with no token answers `400`, not `401`. The new spec line says no token plus invalid input never answers `400`; C55 has no malformed-body case. | Throwaway at 621dc48: no token, `content-type: application/json`, payload `{bad` on pickup gives 400; no token, empty JSON body on return gives 400. Same inputs with an expired token, garbage token or inactive user and an invalid query/id/note give 401; `text/plain` with no token gives 401. | Add a `preParsing`/`onRequest` access check for the three routes, or narrow the spec line to "invalid query, params or parsed body" and add a check for the malformed-body case. | 08d7d21 - C64 |
| Round 2: the empty-JSON-body finding was closed by rewording an approved edge case (`empty body` now `400` when sent with a JSON content type) instead of accepting it; the rule still holds for clients that always send the header, and no check names the empty body with that header (C61 covers malformed and `{}` only). | `spec.md` diff 2a08494..621dc48, line `IF the pickup or return body is absent ... answers 400 VALIDATION_ERROR by Fastify itself`; probe from round 1 still returns 400. | Record the departure as an explicit decision (approved by the user) or add a new criterion with its own check; do not leave an approved criterion edited. | 08d7d21 - C63, C65 (approved edge case restored, no spec rewording) |

## Round 2 (621dc48)

- Finding 1 (401/403 before 400): held for query, params and parsed-body errors (expired, garbage, revoked-style and inactive-user tokens with bad date, bad id and 400-character notes: 401; valid token with bad query: still 400). Not held for a malformed or empty JSON body (new finding). The hook change did not affect other routes: public availability with a bad date still 400, `/admin/requests` with no token 401, and the `proofs.md` run shows every other test file green (63 pass).
- Finding 2 (time bomb): held. Every history seed (`seedReservation` in both files) has an explicit `createdAt`; the remaining `createdAt` orderings are on equipment (real clock) and history rows. The public-cancel history rows in C35/C41 use the real clock but are only counted. Both suites with NOW moved to 2026-11-03: routes 50/50, job 11/11.
- Finding 3 (empty JSON body): documented in the spec, not fixed (new finding above).
- Findings 4 to 7: held by C57/C58/C59/C61 (edge cases and filters), C55/C56 plus the expired token in C29 (auth), C62 (peak).
- Own examples, one per fix: day boundary (a reservation 1 ms before local midnight appears only on the 17th, one at midnight only on the 18th) and exact flag boundary on the route (deadline = now not overdue, now - 1 ms overdue); peak chain 10:00/12:00/13:00 gives free 5 at 10:00 and 4 at 11:30, 12:00 and 13:00; anonymized and cancelled reservation shows no name or e-mail and the return answers 404; expired/garbage/inactive-user variants above.

## Round 3 (08d7d21)

- New finding 1 (body parsed before the access check): held. The hook and the three routes are `onRequest`. Probes: no token with `{bad`, empty, whitespace, a 2 MB body, and `application/json; charset=utf-8` empty all give 401; garbage token, expired token and `{bad` give 401; a valid token with `{bad` gives 400 `VALIDATION_ERROR`; a valid token with `[1]` gives 400. Other test files and routes: unchanged in `proofs.md` (66 pass); `onRequest` still runs before the route hooks and the global `auth` hook is registered first.
- New finding 2 (empty JSON body): held. The approved edge case is restored and the parser is encapsulated: with an empty JSON body, `lost-reports`, `auth/login`, `reservations` and `tracking/.../cancel` still answer 400 `VALIDATION_ERROR` (and 400 for `{bad`). On the three routes: empty body with and without `charset` gives 200, `null` gives 200, whitespace-only gives 400, malformed gives 400 `VALIDATION_ERROR`, `[1]` gives 400.
- Prototype keys: `{"__proto__":{"documentChecked":true}}` and `{"constructor":{"prototype":{"documentChecked":true}}}` with the document required both answer 400 (the keys do not satisfy it); `{"documentChecked":true,"__proto__":{"notes":"zz"},"notes":"real"}` gives 200 and stores `real`; `Object.prototype` is not polluted. Plain `JSON.parse` is safe here because the object only reaches the Zod schemas, which keep the declared keys.
- Large body: a 2 MB body with a valid token gives 413 from Fastify's limit (`{"message":"Request body is too large"}`).
- Residual notes (not blocking): the 413 answer has no `code` (the shared `errorHandler` returns only `message` for other 4xx; same as every route); `application/json` is the only parser replaced and a `text/plain` body is still answered by Fastify's default (401 without a token, since access runs first).

## Own examples (round 1, throwaway tests at HEAD, deleted)

- No token or no ability with invalid input: 400 (finding 1).
- Another equipment type, previous day and next day in the agenda: no leak. Stroller agenda: `totalUnits` 7 and only the stroller reservation.
- Anonymized reservation in the agenda: `visitorName` null. No active equipment: `totalUnits`/`freeUnits` 0 on all 21 slots.
- Block size changed 30 to 60 after a 10:30 reservation: 12 blocks, the 10:30 reservation (and a cancelled one) in its own 10:30-11:30 slot, `freeUnits` 5 (cancelled not counted).
- Reservation two days old, still `reserved`: agenda shows `pickupOverdue` true; pickup answers 409 ("The pickup deadline has passed"); the routine marks it (1) with `completedAt` and history `system`, createdAt equal to the run time; then return and pickup answer 409; the agenda shows `no_show` with both flags false.
- `pickupDeadline` before `startAt`: pickup 409 ("has not started") before the start, no crash. Id of a `lost_report` on return: 404.
- 25 pickups of different reservations, 10 returns, 5 repeated pickups and three routine runs in parallel: 35 x 200, 5 x 409, no 500; the three runs marked 0, 0 and 10; history rows `picked_up` 35, `returned` 10, `no_show` 10 (no duplicates, no deadlock).
- Empty JSON body: finding 3.

## Assertions looser than the criterion, and rules without a check

- Looser: C3 (peak vs count), C30 (any-ability mock), C29 (no expired token), C15 (start side tested 55 minutes away; the exact start is in C16 and the unit test).
- The no-show job wiring in `server.ts` (`startNoShowJob()` after `listen`) has no test; C54 tests the runner, not that the server starts it. The diff touches it and Q5 names it.
- The agenda `pickupOverdue` flag has a unit test (C8) and my route-level probe, but no route-level check; the wiring of `now` from the service to the flags is covered by the logic test only.
- The order of the own slot among the blocks (C7) and the creation order of reservations inside a slot (Q4) are tested only in the unit test, not on the route.
- Document required with a reservation in the wrong status answers `400` before `409` (the document check runs before the transition); the spec does not fix this order and no check names it.
