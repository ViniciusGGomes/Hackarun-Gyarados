# equipment-operations proofs

**HEAD**: 08d7d21
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 66 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run test / ✓ agenda returns the slots of the day in ascending order` | pass |
| C2 | `run test / ✓ agenda slots carry units and reservations with their fields` | pass |
| C3 | `run test / ✓ agenda totals and free units count only reserved and picked up reservations` | pass |
| C4 | `run test / ✓ agenda lists reservations of every status` | pass |
| C5 | `run test / ✓ agenda of a closed day or a day without opening hours has no slots` | pass |
| C6 | `run test / ✓ agenda accepts past dates and dates beyond the advance limit` | pass |
| C7 | `run test / ✓ agenda lists a reservation that starts outside the current blocks in its own slot` | pass |
| C8 | `run test / ✓ overdue flags follow status and the clock at the exact limits` | pass |
| C9 | `run test / ✓ agenda carries no contact data` | pass |
| C10 | `run test / ✓ agenda rejects a missing or invalid date and equipment type` | pass |
| C11 | `run test / ✓ pickup inside the window returns 200 with picked_up and the server time` | pass |
| C12 | `run test / ✓ pickup stores the status the times the document and the notes with one history row` | pass |
| C13 | `run test / ✓ pickup ignores time status and user sent in the body` | pass |
| C14 | `run test / ✓ pickup of a reservation in another status returns 409` | pass |
| C15 | `run test / ✓ pickup before the block start and after the deadline returns 409` | pass |
| C16 | `run test / ✓ pickup at the exact start and at the exact deadline is accepted` | pass |
| C17 | `run test / ✓ pickup requires the document when the setting asks for it` | pass |
| C18 | `run test / ✓ pickup accepts the document absent or false when it is not required` | pass |
| C19 | `run test / ✓ pickup rejects invalid notes and document values` | pass |
| C20 | `run test / ✓ pickup answers 400 for a malformed id and 404 for unknown other-type or anonymized` | pass |
| C21 | `run test / ✓ pickup uses the stored deadline and not the current tolerance setting` | pass |
| C22 | `run test / ✓ return of a picked up reservation returns 200 with returned and the server time` | pass |
| C23 | `run test / ✓ return stores status times notes completedAt and one history row` | pass |
| C24 | `run test / ✓ return frees the unit in the agenda and in the public availability` | pass |
| C25 | `run test / ✓ late return is accepted without penalty` | pass |
| C26 | `run test / ✓ return of a reservation in another status returns 409` | pass |
| C27 | `run test / ✓ return rejects conditionNotes above 300` | pass |
| C28 | `run test / ✓ return answers 400 for a malformed id and 404 for unknown other-type or anonymized` | pass |
| C29 | `run test / ✓ the three routes answer 401 without a valid token` | pass |
| C30 | `run test / ✓ the three routes answer 403 when the user lacks the ability` | pass |
| C31 | `run test / ✓ attendant and manager can use the three routes` | pass |
| C32 | `run test / ✓ the role is read from the database on each request` | pass |
| C33 | `run test / ✓ simultaneous pickups of one reservation apply only one` | pass |
| C34 | `run test / ✓ simultaneous returns of one reservation apply only one` | pass |
| C35 | `run test / ✓ pickup and public cancellation at the same time apply one transition` | pass |
| C36 | `run test / ✓ pickup and no-show run at the same time apply one transition` | pass |
| C37 | `run test / ✓ failure inside a status change rolls back status and history together` | pass |
| C38 | `run test / ✓ history rows hold previous and new status time actor type and user` | pass |
| C39 | `run test / ✓ no-show history has system actor and no user` | pass |
| C40 | `run test / ✓ detail history is ascending with actor type user id and name` | pass |
| C41 | `run test / ✓ public tracking view never exposes history actors or internal notes` | pass |
| C42 | `run test / ✓ no-show marks a reserved reservation past its deadline` | pass |
| C43 | `run test / ✓ no-show leaves reservations within the tolerance untouched` | pass |
| C44 | `run test / ✓ no-show ignores cancelled picked up returned and already no-show reservations` | pass |
| C45 | `run test / ✓ no-show run twice affects nothing the second time` | pass |
| C46 | `run test / ✓ simultaneous no-show runs mark each reservation once` | pass |
| C47 | `run test / ✓ no-show frees the unit in the public availability` | pass |
| C48 | `run test / ✓ failed no-show run changes nothing and logs the failure without personal data` | pass |
| C49 | `run test / ✓ no-show routine has no public endpoint` | pass |
| C50 | `run test / ✓ pickup response carries visitor reservation and history` | pass |
| C51 | `run test / ✓ detail of a reservation has null lost report sac message and no messages` | pass |
| C52 | `run test / ✓ detail carries no credentials or data of other visitors` | pass |
| C53 | `run test / ✓ job log is written only when reservations were affected or the run failed` | pass |
| C54 | `run test / ✓ job runner skips an overlapping run` | pass |
| C55 | `run test / ✓ invalid input is answered 401 without a token and 403 without the ability` | pass |
| C56 | `run test / ✓ each route is wired to its own ability` | pass |
| C57 | `run test / ✓ agenda shows an anonymized reservation without the visitor name` | pass |
| C58 | `run test / ✓ agenda of a type without active equipment has zero units` | pass |
| C59 | `run test / ✓ agenda keeps other days and other equipment types out` | pass |
| C60 | `run test / ✓ agenda overdue flags are set for late pickups and returns` | pass |
| C61 | `run test / ✓ pickup and return with a malformed JSON body return 400 and an empty object is accepted` | pass |
| C62 | `run test / ✓ agenda free units use the peak and not the count of reservations` | pass |
| C63 | `run test / ✓ pickup and return accept an empty body even with a JSON content type` | pass |
| C64 | `run test / ✓ a malformed or empty JSON body is answered 401 without a token and 403 without the ability` | pass |
| C65 | `run test / ✓ a JSON body with an unsafe key is read as plain data and cannot change the result` | pass |
| Build | `pnpm --filter @saas/api run check-types` | pass |

## Output

`Run test` - exit 0

```
 ✓ src/modules/equipment-operations/equipment-operations.logic.test.ts > overdue flags and pickup window > pickup window includes both extremes 1ms
 ✓ src/modules/equipment-operations/equipment-operations.logic.test.ts > assembleSlots > places each reservation in the block that contains its start, in block order 7ms
 ✓ src/modules/equipment-operations/equipment-operations.logic.test.ts > assembleSlots > counts free units from reserved and picked up only 3ms
 ✓ src/modules/equipment-operations/equipment-operations.logic.test.ts > assembleSlots > gives a reservation outside the current blocks a slot of its own 1ms
 ✓ src/modules/equipment-operations/equipment-operations.logic.test.ts > assembleSlots > gives a reservation that starts inside a block but not at its start a slot of its own 1ms
 ✓ src/modules/equipment-operations/equipment-operations.logic.test.ts > assembleSlots > lists the reservations of a slot in order of creation and sets the overdue flags 1ms
 ✓ src/modules/equipment-operations/equipment-operations.logic.test.ts > assembleSlots > returns the blocks with no reservations and every unit free for an empty day 1ms

 Test Files  17 passed (17)
      Tests  279 passed (279)
   Start at  10:14:58
   Duration  53.36s (tests 88%, import 11%, transform 1%)

    Isolate  17 workers spawned · ~223ms startup each (spawn + environment, per file)
             at least ~3.56s faster with isolate: false — reuses workers across files instead of one per file
```
