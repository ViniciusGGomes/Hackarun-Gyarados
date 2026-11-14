# reservations-and-availability proofs

**HEAD**: 2aa9a44
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 48 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run test / ✓ slots build blocks from the weekday opening hours` | pass |
| C2 | `run test / ✓ slots closed or missing weekday has no blocks` | pass |
| C3 | `run test / ✓ slots drop past blocks and keep the one in progress` | pass |
| C4 | `run test / ✓ slots drop dates beyond the maximum advance` | pass |
| C5 | `run test / ✓ free units use peak simultaneity in the loan window` | pass |
| C6 | `run test / ✓ free units never go below zero` | pass |
| C7 | `run test / ✓ startAt outside hours is outside_hours` | pass |
| C8 | `run test / ✓ startAt unaligned past or beyond advance is invalid` | pass |
| C9 | `run test / ✓ protocol matches CAP-XXXX-XXXX with the safe alphabet` | pass |
| C10 | `run test / ✓ protocol values are unique across many calls` | pass |
| C11 | `run test / ✓ AppError becomes its status and code` | pass |
| C12 | `run test / ✓ rate limit returns 429 after 10 requests and recovers next window` | pass |
| C13 | `run test / ✓ availability lists blocks with free units for an open day` | pass |
| C14 | `run test / ✓ availability with every unit taken marks blocks unavailable` | pass |
| C15 | `run test / ✓ availability invalid type or date returns 400 VALIDATION_ERROR` | pass |
| C16 | `run test / ✓ availability type without active equipment has no free blocks` | pass |
| C17 | `run test / ✓ availability closed day returns empty slots` | pass |
| C18 | `run test / ✓ availability counts reserved and picked_up but not cancelled returned or no_show` | pass |
| C19 | `run test / ✓ availability nowAvailable is set only for today` | pass |
| C20 | `run test / ✓ availability records unmet demand when no block is free` | pass |
| C21 | `run test / ✓ availability does not record unmet demand outside its conditions` | pass |
| C22 | `run test / ✓ availability needs no token and exposes no personal data` | pass |
| C23 | `run test / ✓ reservation valid request returns 201 and stores request reservation consent and history` | pass |
| C24 | `run test / ✓ reservation computes endAt and pickupDeadline from the settings` | pass |
| C25 | `run test / ✓ reservation now mode uses the current block` | pass |
| C26 | `run test / ✓ reservation invalid data returns 400 and stores nothing` | pass |
| C27 | `run test / ✓ reservation without valid consent returns 400 CONSENT_REQUIRED` | pass |
| C28 | `run test / ✓ reservation outside the allowed period is rejected` | pass |
| C29 | `run test / ✓ reservation with an unknown location or fields of the other type returns 400` | pass |
| C30 | `run test / ✓ reservation on a taken slot returns 409 SLOT_UNAVAILABLE` | pass |
| C31 | `run test / ✓ reservation second active reservation of the phone returns 409 ACTIVE_RESERVATION_LIMIT` | pass |
| C32 | `run test / ✓ reservation allowed again after the previous one is cancelled or returned` | pass |
| C33 | `run test / ✓ settings changes apply to new bookings and keep stored reservations` | pass |
| C34 | `run test / ✓ reservation failure leaves no orphan request` | pass |
| C35 | `run test / ✓ equipment quantity limits the reservations of a block` | pass |
| C36 | `run test / ✓ simultaneous reservations create exactly as many as there are free units` | pass |
| C37 | `run test / ✓ simultaneous reservations from one phone create only one` | pass |
| C38 | `run test / ✓ simultaneous reservations of different types both succeed` | pass |
| C39 | `run test / ✓ reservation endpoint is rate limited and availability is not` | pass |
| C40 | `run test / ✓ cancel valid reservation returns 200 and records history` | pass |
| C41 | `run test / ✓ cancel frees the unit for availability and a new booking` | pass |
| C42 | `run test / ✓ cancel unknown protocol wrong phone or anonymized returns the same 404` | pass |
| C43 | `run test / ✓ cancel in a final or picked up status returns 409 REQUEST_NOT_CANCELLABLE` | pass |
| C44 | `run test / ✓ cancel invalid phone or reason returns 400` | pass |
| C45 | `run test / ✓ cancel and pickup at the same time apply one transition` | pass |
| C46 | `run test / ✓ cancel of a request that is not a reservation returns 409` | pass |
| C47 | `run test / ✓ cancel view exposes only public fields without a token` | pass |
| Build | `pnpm --filter @saas/api run check-types` | pass |

## Output

`Run test` - exit 0

```
 ✓ src/http/reservations-routes.test.ts > limits and concurrency > simultaneous reservations of different types both succeed 468ms
 ✓ src/http/reservations-routes.test.ts > limits and concurrency > reservation endpoint is rate limited and availability is not 687ms
 ✓ src/http/reservations-routes.test.ts > POST /api/v1/tracking/:protocol/cancel > cancel valid reservation returns 200 and records history 289ms
 ✓ src/http/reservations-routes.test.ts > POST /api/v1/tracking/:protocol/cancel > cancel frees the unit for availability and a new booking 573ms
 ✓ src/http/reservations-routes.test.ts > POST /api/v1/tracking/:protocol/cancel > cancel unknown protocol wrong phone or anonymized returns the same 404 453ms
 ✓ src/http/reservations-routes.test.ts > POST /api/v1/tracking/:protocol/cancel > cancel in a final or picked up status returns 409 REQUEST_NOT_CANCELLABLE 390ms
 ✓ src/http/reservations-routes.test.ts > POST /api/v1/tracking/:protocol/cancel > cancel invalid phone or reason returns 400 296ms
 ✓ src/http/reservations-routes.test.ts > POST /api/v1/tracking/:protocol/cancel > cancel and pickup at the same time apply one transition 559ms
 ✓ src/http/reservations-routes.test.ts > POST /api/v1/tracking/:protocol/cancel > cancel of a request that is not a reservation returns 409 229ms
 ✓ src/http/reservations-routes.test.ts > POST /api/v1/tracking/:protocol/cancel > cancel view exposes only public fields without a token 269ms

 Test Files  12 passed (12)
      Tests  149 passed (149)
   Start at  08:02:50
   Duration  14.42s (tests 75%, import 22%, transform 3%, worker 1%)
```
