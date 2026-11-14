# lost-item-registration proofs

**HEAD**: c66889e
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 48 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run test / ✓ valid report returns 201 with protocol status createdAt and trackingPath` | pass |
| C2 | `run test / ✓ valid report persists request lost report consent and history` | pass |
| C3 | `run test / ✓ absent lostPeriod and unknownLocation store unknown and false` | pass |
| C4 | `run test / ✓ creation leaves match delivery completion and anonymization empty` | pass |
| C5 | `run test / ✓ protocol has the CAP format and a colliding protocol is replaced` | pass |
| C6 | `run test / ✓ two identical reports create two distinct protocols` | pass |
| C7 | `run test / ✓ failure inside the transaction leaves no rows and returns 500 INTERNAL_ERROR` | pass |
| C8 | `run test / ✓ route validates the body with the schema before the controller` | pass |
| C9 | `run test / ✓ each missing required field is rejected` | pass |
| C10 | `run test / ✓ category and lostPeriod accept only the enum values` | pass |
| C11 | `run test / ✓ phone accepts only ten or eleven digits` | pass |
| C12 | `run test / ✓ email must be valid and at most 255 characters` | pass |
| C13 | `run test / ✓ text limits accept the exact size and reject one more` | pass |
| C14 | `run test / ✓ name and description reject empty and whitespace only` | pass |
| C15 | `run test / ✓ photoUrl accepts only http and https URIs` | pass |
| C16 | `run test / ✓ lostDate rejects dates that do not exist` | pass |
| C17 | `run test / ✓ lostDate rejects tomorrow in the local time zone` | pass |
| C18 | `run test / ✓ lostDate accepts today in the local time zone even when UTC is tomorrow` | pass |
| C19 | `run test / ✓ location is rejected when neither locationId nor unknownLocation is sent` | pass |
| C20 | `run test / ✓ location is rejected when both locationId and unknownLocation are sent` | pass |
| C21 | `run test / ✓ text fields are trimmed and control characters removed` | pass |
| C22 | `run test / ✓ unknown fields are stripped` | pass |
| C23 | `run test / ✓ unknown inactive or malformed location is rejected with 400` | pass |
| C24 | `run test / ✓ unknownLocation without locationId is stored as unknown location` | pass |
| C25 | `run test / ✓ accepted false is rejected with CONSENT_REQUIRED` | pass |
| C26 | `run test / ✓ wrong or missing active privacy version is rejected with CONSENT_REQUIRED` | pass |
| C27 | `run test / ✓ valid report stores one consent with version and purpose` | pass |
| C28 | `run test / ✓ route works without a token` | pass |
| C29 | `run test / ✓ response has only the four public fields and no personal data` | pass |
| C30 | `run test / ✓ status sent by the visitor is ignored` | pass |
| C31 | `run test / ✓ logs never contain the body or personal fields even on 500` | pass |
| C32 | `run test / ✓ same phone of another visitor is not revealed` | pass |
| C33 | `run test / ✓ reason and health fields are ignored and never stored` | pass |
| C34 | `run test / ✓ html in description is stored as text and never echoed` | pass |
| C35 | `run test / ✓ empty array and malformed JSON bodies return 400` | pass |
| C36 | `run test / ✓ unexpected error returns 500 INTERNAL_ERROR and logs only name and code` | pass |
| C37 | `run test / ✓ eleventh request in a minute returns 429 TOO_MANY_REQUESTS` | pass |
| C38 | `run test / ✓ invalid requests count toward the limit` | pass |
| C39 | `run test / ✓ limit window ends and requests are accepted again` | pass |
| C40 | `run test / ✓ limits count characters, so an emoji counts as one` | pass |
| C41 | `run test / ✓ invisible zero-width name is rejected as empty` | pass |
| C42 | `run test / ✓ lostDate accepts early years that Date.UTC would shift` | pass |
| C43 | `run test / ✓ empty optional inputs are stored as absent` | pass |
| C44 | `run test / ✓ every control character is removed and only the line break survives in long texts` | pass |
| C45 | `run test / ✓ malformed consent is answered as CONSENT_REQUIRED` | pass |
| C46 | `run test / ✓ consent is checked before the location` | pass |
| C47 | `run test / ✓ unsupported content type answers 415 and stores nothing` | pass |
| Build | `pnpm --filter @saas/api run check-types` | pass |

## Output

`Run test` - exit 0

```
 ✓ src/modules/reservations/reservations.slots.test.ts > slots > current block is the one that contains the instant 2ms
 ✓ src/modules/reservations/reservations.slots.test.ts > free units > free units use peak simultaneity in the loan window 1ms
 ✓ src/modules/reservations/reservations.slots.test.ts > free units > free units ignore reservations that only touch the window edges 0ms
 ✓ src/modules/reservations/reservations.slots.test.ts > free units > free units never go below zero 0ms
 ✓ src/modules/reservations/reservations.slots.test.ts > startAt validation > startAt outside hours is outside_hours 1ms
 ✓ src/modules/reservations/reservations.slots.test.ts > startAt validation > startAt unaligned past or beyond advance is invalid 0ms
 ✓ src/modules/reservations/reservations.slots.test.ts > startAt validation > startAt on an aligned free block inside the window is ok 0ms

 Test Files  14 passed (14)
      Tests  207 passed (207)
   Start at  08:57:26
   Duration  31.19s (tests 81%, import 17%, transform 1%, worker 1%)

    Isolate  14 workers spawned · ~234ms startup each (spawn + environment, per file)
             at least ~3.04s faster with isolate: false — reuses workers across files instead of one per file
```
