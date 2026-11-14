# admin-authentication proofs

**HEAD**: f912ff2
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 39 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run test / ✓ login as attendant returns token and user` | pass |
| C2 | `run test / ✓ login as manager returns role manager` | pass |
| C3 | `run test / ✓ login unknown email returns 401 INVALID_CREDENTIALS` | pass |
| C4 | `run test / ✓ login wrong password returns the same 401 body` | pass |
| C5 | `run test / ✓ login unknown email compares against the dummy hash` | pass |
| C6 | `run test / ✓ login inactive user returns 401 and leaves counters untouched` | pass |
| C7 | `run test / ✓ login invalid body returns 400 VALIDATION_ERROR` | pass |
| C8 | `run test / ✓ login response has no sensitive fields` | pass |
| C9 | `run test / ✓ login accepts a bcrypt hash produced like the seed` | pass |
| C10 | `run test / ✓ wrong password increments failed attempts by one` | pass |
| C11 | `run test / ✓ fifth wrong password locks the account for 15 minutes` | pass |
| C12 | `run test / ✓ login locked account returns 423 even with the right password` | pass |
| C13 | `run test / ✓ login after lock expiry restarts the count` | pass |
| C14 | `run test / ✓ successful login resets attempts and sets lastLoginAt` | pass |
| C15 | `run test / ✓ simultaneous wrong passwords are all counted` | pass |
| C17 | `run test / ✓ me returns the current user from the database` | pass |
| C18 | `run test / ✓ me with an invalid token returns 401 UNAUTHORIZED` | pass |
| C19 | `run test / ✓ me with an expired token returns 401` | pass |
| C20 | `run test / ✓ me after the user was deactivated returns 401` | pass |
| C21 | `run test / ✓ role change applies without a new login` | pass |
| C22 | `run test / ✓ role claim in the token is ignored` | pass |
| C23 | `run test / ✓ logout returns 204` | pass |
| C24 | `run test / ✓ token is rejected after logout` | pass |
| C25 | `run test / ✓ session idle for more than 30 minutes is rejected` | pass |
| C26 | `run test / ✓ activity within 30 minutes keeps the session alive` | pass |
| C27 | `run test / ✓ logout without a token returns 401` | pass |
| C28 | `run test / ✓ login expiresIn is 1800 seconds` | pass |
| C29 | `run test / ✓ admin route without token returns 401` | pass |
| C30 | `run test / ✓ attendant returns 403 on manager route` | pass |
| C31 | `run test / ✓ manager accesses manager route` | pass |
| C32 | `run test / ✓ token from login opens an admin route of its role` | pass |
| C33 | `run test / ✓ auth errors use the ErrorResponse format` | pass |
| C34 | `run test / ✓ attendant can access attendance routes` | pass |
| C35 | `run test / ✓ login email is case-insensitive` | pass |
| C36 | `run test / ✓ me with a non-Bearer header returns 401` | pass |
| C37 | `run test / ✓ lock does not revoke issued tokens` | pass |
| C38 | `run test / ✓ two logins create two independent sessions` | pass |
| C39 | `run test / ✓ login database failure returns 500 without details` | pass |
| Build | `pnpm --filter @saas/api run check-types` | pass |

## Output

`Run test` - exit 0

```
 ✓ src/http/auth-routes.test.ts > admin routes with real login tokens > token from login opens an admin route of its role 20ms
 ✓ src/modules/auth/auth.service.test.ts > login() lockout > simultaneous wrong passwords are all counted 404ms
 ✓ src/modules/auth/auth.service.test.ts > validateSession() and logout() > accepts a session used within the inactivity window and renews its activity 85ms
 ✓ src/modules/auth/auth.service.test.ts > validateSession() and logout() > keeps a session alive as long as each request is within 30 minutes of the previous one 73ms
 ✓ src/modules/auth/auth.service.test.ts > validateSession() and logout() > rejects a session idle for more than 30 minutes 82ms
 ✓ src/modules/auth/auth.service.test.ts > validateSession() and logout() > accepts a session idle for exactly 30 minutes 73ms
 ✓ src/modules/auth/auth.service.test.ts > validateSession() and logout() > rejects an unknown session id 81ms
 ✓ src/modules/auth/auth.service.test.ts > validateSession() and logout() > rejects a session that belongs to another user 98ms
 ✓ src/modules/auth/auth.service.test.ts > validateSession() and logout() > logout revokes the session and later validation rejects it 93ms
 ✓ src/modules/auth/auth.service.test.ts > validateSession() and logout() > two logins create two independent sessions and logout revokes only one 183ms

 Test Files  8 passed (8)
      Tests  82 passed (82)
   Start at  07:23:41
   Duration  3.95s (tests 47%, import 45%, transform 7%, worker 1%)
```
