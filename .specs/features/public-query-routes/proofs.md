# public-query-routes proofs

**HEAD**: 8180c59
**Tree**: dirty - capim-dourado-servicos/docs/specs/authorization-casl.spec.md
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
 ✓ src/http/authorization.test.ts > manager-only routes > manager accesses manager route 19ms
 ✓ src/http/authorization.test.ts > manager-only routes > role is derived from the database 25ms
 ✓ src/http/authorization.test.ts > manager-only routes > attendant cannot reopen final 16ms
 ✓ src/http/authorization.test.ts > manager-only routes > manager can reopen final 26ms
 ✓ src/http/public-routes.test.ts > GET /api/v1/services/:slug > get service detail by slug 27ms
 ✓ src/http/public-routes.test.ts > GET /api/v1/services/:slug > get service missing slug returns 404 16ms
 ✓ src/http/public-routes.test.ts > GET /api/v1/locations > list locations returns only active 14ms
 ✓ src/http/public-routes.test.ts > GET /api/v1/privacy-notice > get privacy notice returns active 23ms
 ✓ src/http/public-routes.test.ts > GET /api/v1/privacy-notice > get privacy notice without an active notice returns 404 11ms
 ✓ src/http/public-routes.test.ts > public routes > public routes work without auth 16ms

 Test Files  5 passed (5)
      Tests  27 passed (27)
   Start at  06:42:09
   Duration  1.67s (import 57%, tests 31%, transform 10%, worker 1%)
```
