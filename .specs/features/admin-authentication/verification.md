# Admin Authentication verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at f912ff2 (verified tree is f912ff2 plus docs commit 2fcabce; no code differs)
**Verifier**: independent sub-agent (author != verifier)

Existing tests: `git diff daf3907~1 HEAD` on `auth.test.ts`, `authorization.test.ts` and `attendance.test.ts` shows only arrangement changes (a `session` mock in `vi.mock` and a `sid` in `jwt.sign`). No `expect` line changed and no test was added or removed.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `auth-routes.test.ts` `login as attendant returns token and user` | yes - role and full user object asserted; `expiresIn` and the token claims are not (C28 covers `expiresIn`; see F1 for `exp`) |
| C2 | `auth-routes.test.ts` `login as manager returns role manager` | yes |
| C3 | `auth-routes.test.ts` `login unknown email returns 401 INVALID_CREDENTIALS` | yes |
| C4 | `auth-routes.test.ts` `login wrong password returns the same 401 body` | yes - `toEqual` against the unknown-email body |
| C5 | `auth.service.test.ts` `unknown email compares against the dummy hash` | yes - one `compare` call with `DUMMY_PASSWORD_HASH`; the dummy is a valid 60-char cost-10 hash (checked: 112 ms vs 74 ms for a real compare) |
| C6 | `auth-routes.test.ts` `login inactive user returns 401 and leaves counters untouched` | partial - sends only the correct password, so a wrong-password increment on an inactive user is not caught here (the unit test catches it, but it is not the check's proof); see F4 |
| C7 | `auth-routes.test.ts` `login invalid body returns 400 VALIDATION_ERROR` | partial - no case for a missing `email` or an empty `password` (removing `.min(1)` survives); see F7 |
| C8 | `auth-routes.test.ts` `login response has no sensitive fields` | yes - login ok, login 401 and `/auth/me`; checks field names and the hash value |
| C9 | `auth.service.test.ts` `accepts a bcrypt hash produced like the seed` | yes |
| C10 | `auth.service.test.ts` `wrong password increments failed attempts by one` | yes - 2 to 3, lock still null |
| C11 | `auth.service.test.ts` `fifth wrong password locks the account for 15 minutes` | yes - exact `lockedUntil`; the 4th-attempt-no-lock side is held by the integration test of C12, not by this test |
| C12 | `auth-routes.test.ts` `login locked account returns 423 even with the right password` | partial - see F2 and F3 |
| C13 | `auth.service.test.ts` `login after lock expiry restarts the count` | yes for lock expired by 1 minute; the exact boundary is not pinned (F3) |
| C14 | `auth.service.test.ts` `successful login resets attempts and sets lastLoginAt` | partial - seed has `lockedUntil: null`, so "clears the lock" is not exercised; see F7 |
| C15 | `auth.service.test.ts` `simultaneous wrong passwords are all counted` | yes for 4 concurrent attempts on an unlocked account (a read-then-write mutant would lose counts); see F5 for the paths it does not reach |
| C17 | `auth-routes.test.ts` `me returns the current user from the database` | yes - name changed in the fake after login and returned |
| C18 | `auth-routes.test.ts` `me with an invalid token returns 401 UNAUTHORIZED` | yes - missing, malformed and wrong secret, with the code |
| C19 | `auth-routes.test.ts` `me with an expired token returns 401` | yes - the session is valid, so only `exp` can cause the 401 |
| C20 | `auth-routes.test.ts` `me after the user was deactivated returns 401` | yes |
| C21 | `auth-routes.test.ts` `role change applies without a new login` | yes - both `/auth/me` and the CASL route change |
| C22 | `auth-routes.test.ts` `role claim in the token is ignored` | yes |
| C23 | `auth-routes.test.ts` `logout returns 204` | yes - status and empty body |
| C24 | `auth-routes.test.ts` `token is rejected after logout` | yes |
| C25 | `auth-routes.test.ts` `session idle for more than 30 minutes is rejected` | yes at 31 min; the exact 30 min bound is pinned only by a unit test outside the proof |
| C26 | `auth-routes.test.ts` `activity within 30 minutes keeps the session alive` | yes - 20 min, then 45 min from login (25 from the last request), so it fails without renewal |
| C27 | `auth-routes.test.ts` `logout without a token returns 401` | yes |
| C28 | `auth-routes.test.ts` `login expiresIn is 1800 seconds` | yes |
| C29 | `auth-routes.test.ts` `admin route without token returns 401` | yes - one route of 27 |
| C30 | `authorization.test.ts` `attendant returns 403 on manager route` | partial - asserts only the status; the code `FORBIDDEN` on a real route is never asserted; see F6 |
| C31 | `authorization.test.ts` `manager accesses manager route` | yes |
| C32 | `auth-routes.test.ts` `token from login opens an admin route of its role` | yes - manager 200, attendant 403, attendant on an attendant route 200 |
| C33 | `error-response.test.ts` `auth errors use the ErrorResponse format` (describe, 6 tests) | partial - synthetic routes only; real `authorize` and plugin errors carry the code only where `auth-routes.test.ts` happens to assert it; see F6 |
| C34 | `attendance.test.ts` `attendant can access attendance routes` | no - asserts a 200; it does not hold "status codes unchanged" for 401, 403, 400 or 404, and its arrangement was adapted; see F6 |
| C35 | `auth-routes.test.ts` `login email is case-insensitive` | yes |
| C36 | `auth-routes.test.ts` `me with a non-Bearer header returns 401` | yes - Basic, Token and a bare token |
| C37 | `auth-routes.test.ts` `lock does not revoke issued tokens` | yes |
| C38 | `auth-routes.test.ts` `two logins create two independent sessions` | yes - revoking the first leaves the second at 200 |
| C39 | `auth-routes.test.ts` `login database failure returns 500 without details` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1: nothing tests the 8 h absolute token life (BR10, T13). Changing `TOKEN_MAX_AGE` to `'1y'`, or dropping the `expiresIn` option so the token never expires, keeps all 82 tests green | `auth.controller.ts:14` signs with `{ expiresIn: TOKEN_MAX_AGE }`; no test decodes `exp`/`iat`, `sub` or `sid` from a login token (`auth-routes.test.ts` only asserts that `accessToken` is a string). C1 and C28 do not cover it | add a check that decodes the login token and asserts `sub`, `sid` and `exp - iat = 28800` (and that `sid` is the created session) | 4e31dea |
| F2: C12's proof test is looser than its criterion. The integration test asserts only `failedLoginAttempts` and the session count, not that `lockedUntil` is unchanged or that the password is not verified. A mutant that runs `bcrypt.compare` before throwing 423, or rewrites `lockedUntil`, still passes it | `auth-routes.test.ts:195-209`. The stricter unit test `locked account is refused even with the right password and nothing changes` exists but is not the check's proof | assert `lockedUntil` unchanged in the C12 integration test, or point C12's proof at a test that also asserts `compare` was not called | 4e31dea |
| F3: lock boundary not pinned. With `lockedUntil == now` the code treats the account as unlocked (`>`, matching BR7/BR8), but the tests use +5 min (C12) and -1 min (C13). Changing `>` to `>=` keeps them green. Own example, exactly 15 min after the 5th failure: login is allowed and the count restarts, which matches the spec | `auth.service.ts:37`; `auth.service.test.ts:135-154` | add unit cases at `now == lockedUntil` (not locked, count restarts) and `lockedUntil == now + 1 ms` (locked) | 4e31dea |
| F4: ordering of the inactive and locked rules disagrees with the spec flow and is untested. The code checks `!user.active` before `lockedUntil`, so an inactive user with a future `lockedUntil` gets `401 INVALID_CREDENTIALS`, while the Authentication Flow lists the lock check (423) before the inactive check (401). Also, C6's proof sends only the correct password | `auth.service.ts:32-39`; spec Authentication Flow; `auth-routes.test.ts:144-153` | decide which order is intended (the code's order leaks less); then amend the spec flow or the code, and add a test for an inactive and locked user plus a wrong password on an inactive user in the C6 proof | 4e31dea |
| F5: C15 covers only the unlocked, below-threshold path. Concurrent attempts after a lock expired (or with a stale count of 5 or more) each call `resetLock` and then `increment`, so one attempt's reset can erase another's increment, losing counts. The test also never crosses the 5-attempt threshold concurrently. The fake makes `increment` atomic by construction, so the test proves that the service uses `increment`, not that the database is atomic | `auth.service.ts:41-52`; `fake-prisma.ts:36-44`; `auth.service.test.ts:181-190` | either fold the reset and the first increment into one conditional update (reset via the update itself), or record the gap as accepted for the local scope; add a concurrent case from an expired lock | 4e31dea |
| F6: Errors/status-code checks are weaker than their criteria. C34's proof asserts only that an attendant gets 200 (arrangement adapted), so "existing routes keep their status codes" (401, 403, 400, 404 of `BadRequestError`/`NotFoundError`) is not held. C30 asserts only 403, and no test asserts `code: 'FORBIDDEN'` through the real `authorize`; C33 uses synthetic routes | `attendance.test.ts` `attendant can access attendance routes`; `authorization.test.ts:54-66`; `error-response.test.ts` | add assertions of status and `code` for 403 through a real `/admin/*` route and for the unchanged 400/404 statuses (for example a `NotFoundError` case in `error-response.test.ts`) | 4e31dea |
| F7: smaller loose assertions. C7 has no case with a missing `email` or an empty `password`, so removing `.min(1)` survives. C14's seed has `lockedUntil: null`, so clearing the lock is not exercised. A signed token without `sid` is not tested (T12 done-when); that guard (`auth.ts:24`) matters because the fake `session.findUnique({ where: { id: undefined } })` returns null while real Prisma throws a validation error, so deleting the guard turns a 401 into a 500 only in production | `auth-routes.test.ts:155-169`; `auth.service.test.ts:173-179`; `auth.ts:24-26`; `fake-prisma.ts:82-86` | add: login with no email and with an empty password; a success login from a past `lockedUntil` and a nonzero count asserting `lockedUntil` null; a validly signed token without `sid` returning 401 `UNAUTHORIZED` | 4e31dea |
