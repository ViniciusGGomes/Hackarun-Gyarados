# authorization-casl verification

**Verdict**: PASS
**Proofs**: `proofs.md` at a375181
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `packages/auth/src/permissions.test.ts` `only attendant and manager are valid roles` | yes |
| C2 | `packages/auth/src/permissions.test.ts` `attendant can read Request` | yes |
| C3 | `packages/auth/src/permissions.test.ts` `attendant can updateStatus on non-final` | yes |
| C4 | `packages/auth/src/permissions.test.ts` `attendant cannot updateStatus on final` | yes |
| C5 | `packages/auth/src/permissions.test.ts` `attendant cannot read Indicator` | yes |
| C6 | `packages/auth/src/permissions.test.ts` `manager can read Indicator` | yes |
| C7 | `packages/auth/src/permissions.test.ts` `manager can updateStatus on final` | yes |
| C8 | `packages/auth/src/permissions.test.ts` `manager can create User` | yes |
| C9 | `packages/auth/src/permissions.test.ts` `unknown role throws` | yes |
| C10 | `apps/api/src/http/middlewares/auth.test.ts` `no token returns 401` | yes |
| C11 | `apps/api/src/http/middlewares/auth.test.ts` `invalid token returns 401` | yes |
| C12 | `apps/api/src/http/authorization.test.ts` `attendant returns 403 on manager route` | yes |
| C13 | `apps/api/src/http/authorization.test.ts` `manager accesses manager route` | yes |
| C14 | `apps/api/src/http/middlewares/auth.test.ts` `inactive user is denied` | yes |
| C15 | `apps/api/src/http/authorization.test.ts` `role is derived from the database` | yes |
| C16 | `apps/api/src/http/authorization.test.ts` `attendant cannot reopen final` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Attendant is not denied with 403 when reopening a final request — the route never checks the request's status | `authorize('updateStatus', 'Request')` calls `ability.can('updateStatus', 'Request')` with a string subject; a throwaway test at HEAD shows `defineAbilityFor(attendant).can('updateStatus', 'Request') === true`, so the `{ status: { $nin: FINAL_REQUEST_STATUSES } }` condition is never evaluated and the `PATCH /admin/requests/:id/status` route does not reject an attendant. C16's proof is the unit test (same as C4), which asserts the object-subject ability case, not the 403 the criterion (AUTH-06 AC 2) and the Test Coverage Matrix ("reopen" at the integration layer) name. T9 records the object check as deferred to the controller ("futuro"). | Enforce the status condition at the route/controller (pass `{ __typename: 'Request', status }` to `can`), add an integration test asserting `403` for an attendant `PATCH` on a final request, or amend AUTH-06 AC 2 / add a new criterion recording the deferral (never edit the approved one) | a375181 |
| C1's test proves `attendant`/`manager` valid and `ADMIN` invalid, but not "exactly two" roles | `permissions.test.ts:16-20` — a fourth role (e.g. `superadmin`) added to `roleSchema` would keep all three assertions green while violating AC 1 | assert a second non-role literal is rejected (or accept the type union as the source of truth and document it) | d468cdc |
