# authorization-casl proofs

**HEAD**: a375181
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 18 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run unit / ✓ only attendant and manager are valid roles` | pass |
| C2 | `run unit / ✓ attendant can read Request` | pass |
| C3 | `run unit / ✓ attendant can updateStatus on non-final` | pass |
| C4 | `run unit / ✓ attendant cannot updateStatus on final` | pass |
| C5 | `run unit / ✓ attendant cannot read Indicator` | pass |
| C6 | `run unit / ✓ manager can read Indicator` | pass |
| C7 | `run unit / ✓ manager can updateStatus on final` | pass |
| C8 | `run unit / ✓ manager can create User` | pass |
| C9 | `run unit / ✓ unknown role throws` | pass |
| C10 | `run integration / ✓ no token returns 401` | pass |
| C11 | `run integration / ✓ invalid token returns 401` | pass |
| C12 | `run integration / ✓ attendant returns 403 on manager route` | pass |
| C13 | `run integration / ✓ manager accesses manager route` | pass |
| C14 | `run integration / ✓ inactive user is denied` | pass |
| C15 | `run integration / ✓ role is derived from the database` | pass |
| C16 | `run integration / ✓ attendant cannot reopen final` | pass |
| Build | `pnpm --filter @saas/auth run check-types` | pass |
| Build | `pnpm --filter @saas/api run check-types` | pass |

## Output

`Run unit` - exit 0

```

 ✓ src/permissions.test.ts > only attendant and manager are valid roles 3ms
 ✓ src/permissions.test.ts > attendant can read Request 1ms
 ✓ src/permissions.test.ts > attendant can updateStatus on non-final 1ms
 ✓ src/permissions.test.ts > attendant cannot updateStatus on final 1ms
 ✓ src/permissions.test.ts > attendant cannot read Indicator 1ms
 ✓ src/permissions.test.ts > manager can read Indicator 0ms
 ✓ src/permissions.test.ts > manager can updateStatus on final 0ms
 ✓ src/permissions.test.ts > manager can create User 0ms
 ✓ src/permissions.test.ts > unknown role throws 1ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  05:21:08
   Duration  462ms (import 73%, transform 18%, tests 5%, worker 5%)
```

`Run integration` - exit 0

```
 ✓ src/http/middlewares/auth.test.ts > auth middleware > no token returns 401 326ms
 ✓ src/http/middlewares/auth.test.ts > auth middleware > invalid token returns 401 7ms
 ✓ src/http/middlewares/auth.test.ts > auth middleware > inactive user is denied 7ms
 ✓ src/http/authorization.test.ts > manager-only routes > attendant returns 403 on manager route 345ms
 ✓ src/http/attendance.test.ts > attendance routes > attendant can access attendance routes 353ms
 ✓ src/http/attendance.test.ts > attendance routes > manager can access attendance routes 16ms
 ✓ src/http/authorization.test.ts > manager-only routes > manager accesses manager route 14ms
 ✓ src/http/authorization.test.ts > manager-only routes > role is derived from the database 12ms
 ✓ src/http/authorization.test.ts > manager-only routes > attendant cannot reopen final 13ms
 ✓ src/http/authorization.test.ts > manager-only routes > manager can reopen final 15ms

 Test Files  3 passed (3)
      Tests  10 passed (10)
   Start at  05:21:11
   Duration  1.48s (import 57%, tests 34%, transform 8%, worker 1%)
```
