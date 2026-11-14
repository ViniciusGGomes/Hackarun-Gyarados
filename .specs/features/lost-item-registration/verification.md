# lost-item-registration verification

**Verdict**: PASS
**Proofs**: `proofs.md` at c66889e (round 2, 48 pass); round 1 judged at 3a6a7a6
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `lost-reports-routes.test.ts` `valid report returns 201 with protocol status createdAt and trackingPath` | yes - round 2: `createdAt` is compared with the stored row's ISO value |
| C2 | `lost-reports-routes.test.ts` `valid report persists request lost report consent and history` | yes |
| C3 | `lost-reports-routes.test.ts` `absent lostPeriod and unknownLocation store unknown and false` | yes |
| C4 | `lost-reports-routes.test.ts` `creation leaves match delivery completion and anonymization empty` | yes |
| C5 | `lost-reports-routes.test.ts` `protocol has the CAP format and a colliding protocol is replaced` | yes - the format itself is asserted by C1's test |
| C6 | `lost-reports-routes.test.ts` `two identical reports create two distinct protocols` | yes |
| C7 | `lost-reports-routes.test.ts` `failure inside the transaction leaves no rows and returns 500 INTERNAL_ERROR` | yes - a trigger fails the consent insert after request and lost report exist |
| C8 | `lost-reports-routes.test.ts` `route validates the body with the schema before the controller` | yes (round 2: wrong consent in the body and a spy on `findActivePrivacyVersion` that must not be called; round 1 said: no - a missing description gives the same 400 and `details` if the Zod parse ran inside the service; fixed in round 2) |
| C9 | `lost-reports.schemas.test.ts` `each missing required field is rejected` | yes - one field at a time, asserts the failing field |
| C10 | `lost-reports.schemas.test.ts` `category and lostPeriod accept only the enum values` | yes |
| C11 | `lost-reports.schemas.test.ts` `phone accepts only ten or eleven digits` | yes - 9 and 12 digits, mask, letters, empty |
| C12 | `lost-reports.schemas.test.ts` `email must be valid and at most 255 characters` | yes - 255 accepted, 256 rejected |
| C13 | `lost-reports.schemas.test.ts` `text limits accept the exact size and reject one more` | yes - 120/500/300/500 and +1 (counts UTF-16 units, F2) |
| C14 | `lost-reports.schemas.test.ts` `name and description reject empty and whitespace only` | yes |
| C15 | `lost-reports.schemas.test.ts` `photoUrl accepts only http and https URIs` | yes |
| C16 | `lost-reports.schemas.test.ts` `lostDate rejects dates that do not exist` | yes |
| C17 | `lost-reports.schemas.test.ts` `lostDate rejects tomorrow in the local time zone` | yes |
| C18 | `lost-reports.schemas.test.ts` `lostDate accepts today in the local time zone even when UTC is tomorrow` | yes - at 01:00Z, also asserts the 17th is rejected |
| C19 | `lost-reports.schemas.test.ts` `location is rejected when neither locationId nor unknownLocation is sent` | yes |
| C20 | `lost-reports.schemas.test.ts` `location is rejected when both locationId and unknownLocation are sent` | yes |
| C21 | `lost-reports.schemas.test.ts` `text fields are trimmed and control characters removed` | yes together with C44 - the original test still exercises only U+0000, U+0007, U+0001, tab and CR, but C44 sweeps every code point |
| C22 | `lost-reports.schemas.test.ts` `unknown fields are stripped` | yes |
| C23 | `lost-reports-routes.test.ts` `unknown inactive or malformed location is rejected with 400` | yes |
| C24 | `lost-reports-routes.test.ts` `unknownLocation without locationId is stored as unknown location` | yes |
| C25 | `lost-reports-routes.test.ts` `accepted false is rejected with CONSENT_REQUIRED` | yes |
| C26 | `lost-reports-routes.test.ts` `wrong or missing active privacy version is rejected with CONSENT_REQUIRED` | yes |
| C27 | `lost-reports-routes.test.ts` `valid report stores one consent with version and purpose` | yes - round 2: `acceptedAt` within 5 s of the request's `createdAt` (still loose by 5 s) |
| C28 | `lost-reports-routes.test.ts` `route works without a token` | yes - round 2: also 201 with an invalid bearer token; the response-header assertion was removed |
| C29 | `lost-reports-routes.test.ts` `response has only the four public fields and no personal data` | yes |
| C30 | `lost-reports-routes.test.ts` `status sent by the visitor is ignored` | yes |
| C31 | `lost-reports-routes.test.ts` `logs never contain the body or personal fields even on 500` | yes - console spies only; the app has no Fastify logger |
| C32 | `lost-reports-routes.test.ts` `same phone of another visitor is not revealed` | yes |
| C33 | `lost-reports-routes.test.ts` `reason and health fields are ignored and never stored` | yes |
| C34 | `lost-reports-routes.test.ts` `html in description is stored as text and never echoed` | yes |
| C35 | `lost-reports-routes.test.ts` `empty array and malformed JSON bodies return 400` | yes - array, broken JSON, empty, `null` (non-JSON content types not covered, F6) |
| C36 | `error-response.test.ts` `unexpected error returns 500 INTERNAL_ERROR and logs only name and code` | yes |
| C37 | `lost-reports-routes.test.ts` `eleventh request in a minute returns 429 TOO_MANY_REQUESTS` | yes - ten pass, eleventh blocked, 10 rows |
| C38 | `lost-reports-routes.test.ts` `invalid requests count toward the limit` | yes |
| C39 | `lost-reports-routes.test.ts` `limit window ends and requests are accepted again` | yes - round 2: 59_999 ms still 429, 60_000 ms is 201 |
| C40 | `lost-reports.schemas.test.ts` `limits count characters, so an emoji counts as one` | yes - 119+emoji and 499+emoji accepted, 120+emoji and 500+emoji rejected (name, description; identificationDetail not in the test) |
| C41 | `lost-reports.schemas.test.ts` `invisible zero-width name is rejected as empty` | yes - U+200B pair for name; U+FEFF/U+2060 mix for description |
| C42 | `lost-reports.schemas.test.ts` `lostDate accepts early years that Date.UTC would shift` | yes - 0050-01-01, 0001-01-01 accepted, 0050-02-30 rejected |
| C43 | `lost-reports-routes.test.ts` `empty optional inputs are stored as absent` | yes - stored columns are null (route level, DB read back) |
| C44 | `lost-reports.schemas.test.ts` `every control character is removed and only the line break survives in long texts` | yes - U+0000-U+001F, U+007F, U+0080-U+009F one by one in name and description; line break kept in description only |
| C45 | `lost-reports-routes.test.ts` `malformed consent is answered as CONSENT_REQUIRED` | yes - seven malformed shapes, and a missing consent stays VALIDATION_ERROR |
| C46 | `lost-reports-routes.test.ts` `consent is checked before the location` | yes - wrong consent plus inactive location |
| C47 | `lost-reports-routes.test.ts` `unsupported content type answers 415 and stores nothing` | yes - asserts 415 and no rows; the body shape is not asserted (spec keeps Fastify's answer) |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1 C21 does not hold the control-character rule, and the rule is incomplete | Test uses only U+0000/U+0007/U+0001 (`lost-reports.schemas.test.ts:156`). Own example: `name` `Ma\u0085ria` is stored with U+0085 intact (length 6); the regex `/[\u0000-\u001F\u007F]/` skips the C1 controls U+0080-U+009F. U+000B and U+007F are removed but no test says so | Remove U+0080-U+009F in `lost-reports.schemas.ts:6-7`; assert U+000B, U+001F, U+007F, U+0085, U+009F in C21's test | c66889e - C44 |
| F2 Limits count UTF-16 units, not characters | Own example: `name` = 119 `a` + one emoji (120 characters) answers `400` "<=120"; same for `description` 499 + emoji. Spec limits are in characters and the columns are `varchar(n)` (code points) | Count code points for name, description, identificationDetail (and photoUrl, email); add an emoji-at-the-limit case to C13 | c66889e - C40 |
| F3 Malformed `consent` answers `VALIDATION_ERROR`; spec says `CONSENT_REQUIRED` | Own examples, all `400 VALIDATION_ERROR`: `accepted` absent, `"true"`, `null`; `privacyNoticeVersion` `""` and number `1.0`. Spec Cons AC 1-2: "accepted is not true" / "version is not the active one" = `CONSENT_REQUIRED` (`lost-reports.schemas.ts:54-57`) | Let any non-`true` accepted and any other version reach the service, or add a new requirement stating malformed consent is `VALIDATION_ERROR`, with a check | c66889e - C45 |
| F4 C8 does not prove validation runs before the controller | One body without `description`; the same `400` and `details` result if the parse moved into the service. No body that is invalid and also has a wrong consent version (must be `VALIDATION_ERROR`, flow step 2 before 3) | Add that body (consent version `0.0` plus a missing field), assert `VALIDATION_ERROR` and that the service was not called (spy) | c66889e - C8, C46 |
| F5 Whitespace-like and early-year edge values | Own examples: `name` `​` (zero-width space) answers `201` and stores an invisible name, spec Val AC 7 says empty or only whitespace. `lostDate` `0050-01-01` and `0001-01-01` answer `400 Invalid calendar date` because `Date.UTC` maps years 0-99 to 1900-1999 in `LostDateSchema`, although they are real dates and Q3 sets no lower limit | Treat zero-width/format characters as empty for name and description; validate the calendar date without the `Date.UTC` year mapping (`setUTCFullYear`) | c66889e - C41, C42 |
| F6 Non-JSON content type answers without the `ErrorResponse` shape | Own example: `content-type: application/x-www-form-urlencoded` answers `415 {"message":"Unsupported Media Type"}` (no `statusCode`/`code`): `error-handler.ts:62-64` was left as is while Fastify's 400s were mapped. Spec: a non-object body is `400 VALIDATION_ERROR` | Map the remaining 4xx to `{ statusCode, code, message }` (415 as `VALIDATION_ERROR` 400 or another approved code) and add it to C35 | c66889e - C47 (spec LIR-12 AC 7: Fastify 415 kept) |
| F7 Empty optional strings are inconsistent | Own examples: `identificationDetail` `"   "` is stored as `''` (not null); `email` `""` and `photoUrl` `""` answer `400` (spec only says absent or `null` email is empty). A form that posts empty optional inputs cannot register | Decide in a new requirement with a check: empty after trim means absent for the three optional strings; implement with a transform to `undefined` | c66889e - C43 (spec assumption: empty optional = absent) |

## Looser than the criterion

- C27: `acceptedAt` is only `toBeInstanceOf(Date)`; the acceptance time is compared with nothing.
- C1: `createdAt` is only "parses as a date".
- C28: `expect(response.headers.authorization).toBeUndefined()` reads a response header and proves nothing.
- C39: only 61 s after the burst; the exact 60 s edge (`now >= resetAt`) is not asserted.
- C3 proves both defaults in one request; C32 proves only that the first protocol and name are absent from the second response.

## Rules the diff touched that no check names

- The consent-before-location order in `lost-reports.service.ts` (spec flow step 3 before 4) has no test with both wrong.
- `error-handler.ts` generic 4xx branch (`{ message }` only) is unproven and wrong for 415 (F6).
- `vitest.config.mts` `fileParallelism: false` is wiring for the shared test database; no check names it.

## Own examples that held

- 8 concurrent identical requests: eight `201`, eight distinct protocols, 8 requests and 8 consents stored.
- `lostDate` at the local midnight (02:59:59Z, then 03:00:00Z): 16th ok and 17th rejected, then 17th ok and 18th rejected; 2024-02-29 accepted, 2025-02-29 rejected.
- `locationId` of other UUID versions (v1, v7, nil, upper case) with an active location: accepted; a non-RFC `aaaaaaaa-...` is rejected as `Invalid UUID` (DB ids come from `gen_random_uuid`, so no impact).
- `text/plain` body and no body: `400 VALIDATION_ERROR`.

## Round 2 (fix commit c66889e)

Each finding above is held by the fix and its test; none blocks. Own examples run at HEAD (throwaway, deleted):

| Finding | Fix and test enough? | New example the tests do not name |
| --- | --- | --- |
| F1 | yes - `CONTROL` now covers U+007F-U+009F; C44 sweeps all 65 code points | `identificationDetail` `ab​c` stored `abc`; `email` with an inner U+200B stored `maria@email.com`. Residual: C44 only covers name and description, not identificationDetail/email | c66889e - C44 |
| F2 | yes - `maxChars` counts code points; C40 at the limit | 120 emoji `name`, 500 emoji `description` and 300 emoji `identificationDetail` answered 201 and stored in the `varchar` columns; 121/301 rejected. `photoUrl` and `email` still use UTF-16 `.max` (ASCII in practice) | c66889e - C40 |
| F3 | yes - service compares `accepted !== true`; C45 | `accepted: 1`, version `" 1.0 "` and version `["1.0"]` answer `CONSENT_REQUIRED`; `consent` as `"yes"`, `[]` or `null` stays `VALIDATION_ERROR` as the spec says | c66889e - C45 |
| F4 | yes - C8 spy and C46 order | bad `category` plus wrong consent answers `VALIDATION_ERROR` | c66889e - C8, C46 |
| F5 | yes for zero-width (C41) and early years (C42) | `0000-01-01`, `0000-02-29` and `0004-02-29` accepted and read back from PostgreSQL unchanged; `9999-12-31` rejected as future. Residual: a `name` made only of U+200E or U+202E (bidi marks, not in the spec's list) is still accepted as an invisible name | c66889e - C41, C42 |
| F6 | resolved by a spec decision (LIR-12 AC 7 keeps Fastify's 415); C47 | `application/xml` and `multipart/form-data` also 415 and nothing stored. Residual: the 415 and a 2 MB JSON (`413 {"message":"Request body is too large"}`) have no `statusCode`/`code` | c66889e - C47 (spec LIR-12 AC 7: Fastify 415 kept) |
| F7 | yes - `emptyAsAbsent`; C43 (route) and schema test | `email` `"   "` stored null; `email: null` null. Residual: `identificationDetail: null` and `photoUrl: null` answer 400; `identificationDetail` `"​"` is stored as `''` (the empty check runs before zero-width removal) | c66889e - C43 (spec assumption: empty optional = absent) |

Residual notes (not blocking, no new finding): the four items marked Residual above; C27's 5 s tolerance; C40/C44 do not cover every field the criterion names.
