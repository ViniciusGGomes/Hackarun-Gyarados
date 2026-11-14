# Public query routes verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 36433bf
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `public-routes.test.ts` `list services returns only active ordered` (a same-named test also exists in `services.service.test.ts`) | yes - the fake honours `where`/`orderBy`, so dropping the filter or the order fails; asserts exact slugs `['a','b']` and the exact key set |
| C2 | `public-routes.test.ts` `get service detail by slug` | no - `toMatchObject` omits `id`, `name`, `shortDescription`, `icon`, `kind`, `flow`, `equipmentType`; `isOpenNow` is only `typeof boolean`; `openingHours` order is not asserted. Leak check covers only `active` and `sortOrder` |
| C3 | `public-routes.test.ts` `get service missing slug returns 404` | yes - asserts 404 and `code: 'NOT_FOUND'` (message not asserted, which the spec does not fix) |
| C4 | `public-routes.test.ts` `list locations returns only active` | yes - `toEqual` on the exact public shape; the fake honours `where` |
| C5 | `public-routes.test.ts` `get privacy notice returns active` | yes - `toEqual` of exactly `{version, text, updatedAt}`, so `id`/`active` leaks and a wrong `publishedAt` mapping fail |
| C6 | `services.service.test.ts` `isOpenNow is computed` (4 cases) | no - the open (`10:00`) and close (`22:00`) boundaries are never exercised, so `<` vs `<=` or `<=` vs `<` passes; the UTC-3 offset is pinned only on one side, and an offset of -4 passes all four cases |
| C7 | `public-routes.test.ts` `public routes work without auth` | yes - all four URLs, no token, `auth` plugin registered; an added `authorize` would give 401 and fail |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C6 does not hold the boundaries or the offset of `isOpenNow` | `services.service.test.ts` cases use 09:00, 12:00 and Sunday 23:00 local. Shifting the open bound, the close bound or the offset to -4 leaves all four green. My throwaway probe on HEAD (10:00 true, 09:59 false, 22:00 false, 21:59 true, no row false) passes, so the code is right; the test does not hold it | add cases at exactly 10:00 (true), 09:59 (false), 22:00 (false) and 21:59 (true), plus one that separates -3 from -4 (for example 10:30 local) | 8180c59 |
| C2 integration assertion is looser than the ServiceDetail criterion | `public-routes.test.ts` `get service detail by slug`: `toMatchObject` leaves seven base `Service` fields unchecked and `isOpenNow` is only a type check; a regression that drops `kind` or `flow` from the response passes | assert the full body with `toEqual` (or add the missing fields) and pin `isOpenNow` with a fixed clock or by asserting the hours mapping | 8180c59 |
| Duplicate test names across layers make the proof selector ambiguous | C1, C2 and C3 names exist in both `services.service.test.ts` (unit) and `public-routes.test.ts` (integration); `proofs.md` output shows only the integration lines, so a green unit run could be credited to a check | give the unit tests distinct names or confirm the proof selects the integration file | 8180c59 |

Own examples run at HEAD (throwaway file, removed): boundaries at 10:00 and 22:00 local, a weekday with no `OpeningHour` row, and OpenAPI generation (`jsonSchemaTransform`) with `z.date()` in `PrivacyNoticeSchema`. All behaved correctly; no defect in the implementation found. Rules the diff touches that no check names: `openingHours` ordering by weekday (repository only) and the null-settings fallback (`loanDurationMinutes` etc. become `null`); neither is a rule the spec fixes beyond the Assumptions table.
