# public-query-routes proofs

**HEAD**: 55d7490
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 8 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run test / ✓ list services returns only active ordered` | pass |
| C2 | `run test / ✓ get service detail by slug` | pass |
| C3 | `run test / ✓ get service missing slug returns 404` | pass |
| C4 | `run test / ✓ list locations returns only active` | pass |
| C5 | `run test / ✓ get privacy notice returns active` | pass |
| C6 | `run test / ✓ isOpenNow is computed` | pass |
| C7 | `run test / ✓ public routes work without auth` | pass |
| Build | `pnpm --filter @saas/api run check-types` | pass |

## Output

`Run test` - exit 0

```
 ✓ src/http/authorization.test.ts > manager-only routes > manager accesses manager route 17ms
 ✓ src/http/authorization.test.ts > manager-only routes > role is derived from the database 24ms
 ✓ src/http/authorization.test.ts > manager-only routes > attendant cannot reopen final 18ms
 ✓ src/http/authorization.test.ts > manager-only routes > manager can reopen final 24ms
 ✓ src/http/public-routes.test.ts > GET /api/v1/services/:slug > get service detail by slug 32ms
 ✓ src/http/public-routes.test.ts > GET /api/v1/services/:slug > get service missing slug returns 404 20ms
 ✓ src/http/public-routes.test.ts > GET /api/v1/locations > list locations returns only active 15ms
 ✓ src/http/public-routes.test.ts > GET /api/v1/privacy-notice > get privacy notice returns active 27ms
 ✓ src/http/public-routes.test.ts > GET /api/v1/privacy-notice > get privacy notice without an active notice returns 404 12ms
 ✓ src/http/public-routes.test.ts > public routes > public routes work without auth 16ms

 Test Files  5 passed (5)
      Tests  27 passed (27)
   Start at  06:44:32
   Duration  2.17s (import 61%, tests 27%, transform 11%, worker 1%)
```
