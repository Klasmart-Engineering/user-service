# RFC-XXX

## Synopsis

Give a general overview about the covered content, aka. the "executive summary"

## Background

Add details: Briefly outline the problem domain, illustrate previews implementations, the status quo and/or what’s wrong.

For documentation of discovery ticket’s findings, briefly illustrate what the task was.

Link related tickets if applicable.

## [ Implementation/ Analysis / Findings / Proposal* ]

*Pick the ones that fits best*

For discovery ticket, describe what was explored and what was discovered. Draw conclusions and document the possible next steps.

When documenting a workflow, include graphs / charts that visualise the textual description.

When suggesting a new design, revisit the RFC when the decision for a specific design approach has been made.

### Error handling

Describe how the errors will be handled.

For example:

* New errors with `code`, `message` and `variables` (if any)
* When error happens, stop the operation or just move over to collect other errors before stop the operation
* How we return errors to the client
* If necessary, may involve/coordinate the client teams for their ideas
* If need to send the error to New Relic for metrics/monitoring, please describe it as well

## Out of scope

List anything that is explicitly outside of the scope of the RFC to help keep discussion focused and avoid scope creep.
Consider giving reasons for why something was considered out of scope. For example:

* X is/will be discussed in it's own RFC
* X is owned by another team who will define it themselves
* X is not required for an MVP

## Appendix

Optional link relevant information  (e.g API docs)

## Decision

For each person involved, list their review status [pending/approved/rejected]. Require explicit status reviews from each person.
e.g.

|     Reviewer     |  Status  | Color |
|------------------|----------|-------|
| John Smith       | Approved |   🟢  |
| Lisa Weaver      | Rejected |   🔴  |
| Olivier Pacheco  | Pending  |   🟡  |

Default reviewer list - deleted/add to as appropriate:

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Enrique          | Pending  |   🟡   |
| Oliver           | Pending  |   🟡   |
| Max              | Pending  |   🟡
| Matthew          | Pending  |   🟡   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Sam              | Pending  |   🟡   |
| Raphael          | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Pending  |   🟡   |
