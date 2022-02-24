# Proof of Concept for synchronisation of alert definitions

Shows simple mechanism of synchronising our alert definition "database" with what is defined and operational in New Relic.
Changes should always be made from the repository side, not New Relic, *unless* it is a policy deletion.
When the sync mechanism is triggered/called, it executes the [Synchronisation Algorithm](#synchronisation-algorithm) for each environment folder (Alpha, Prod, etc.).

Note: this POC uses the New Relic REST API for expendiency, but the algorithm can be adapted to use New Relic's NerdGraph API as well.

## In Practice

There are a few options for how/when/where to run the synchronisation algorithm:

1. During every CI/CD build triggered from a merge into master
2. Locally by a developer, direct call to the sync method
3. Locally by a developer, through a Bash script

The first option is the natural "automated" solution. However, the problem with this is that the sync algorithm may require updating the local definitions *after* the API calls have been made. Any change to the repo requires a PR, so the CI/CD script would raise a PR and this is not what a CI/CD pipeline should do.

The second and third options circumvent the CI/CD problem. The second option is arguably the riskiest option as it allows the developer to make a direct call to remote, and is the least-preferable option. 

To counter this, we have the third option which takes advantage of *process* as the alternative to a *technological* solution that the first option offers. With the third option, we can decision a Bash script to ask the developer whether they wish to proceed, along with other "checks" like submitting the API key. In this way we can prevent accidental changes. Precedence for this approach exists in how User Service conducts releases where a Bash script is also used.

## Synchronisation Algorithms

This algorithm first deals with policy CRUD operations before dealing with condition CRUD operations, because conditions depend on policies existing.
New Relic-side's information version will be referred to as "remote", and the repository's "local".

### Policies

The algorithm below is for creating and updating. For deleting, perform the delete in the New Relic UI as extra care needs to be taken in handling KidsLoop-wide alert policies, and also the logic involved in comparing what is *not* existent in local to what should *not* exist in remote may make dangerous assumptions about what should or should not be deleted.

1. Make a GET request to `https://api.eu.newrelic.com/v2/alerts_policies.json` to fetch all existing alert policies from New Relic in our account (our API key identifies us).
2. Fetch local policies, and for each *local* policy JSON:
    1. If local `id` is present, find the corresponding policy JSON in the remote policy set with the same `id`. Else, if local `name` is present, find the corresponding policy JSON with the same `name`.
    2. If no corresponding policy JSON was found, this means we are in policy creation mode. If one was found and the local and remote versions differ, this means we are in policy update mode.
    3. Perform a creation or update request, depending on the mode.
    4. Retrieve the created or updated policy from the API response, and write it to local.

### Conditions

Apply a similar algorithm for each condition within each local policy for create and update modes. In this case, the GET request to send per policy takes the form of `https://api.eu.newrelic.com/v2/alerts_conditions.json?policy_id=152349`.

For deletion, instead of determining whether there is a corresponding condition in remote, we would go in the other direction and check whether every remote condition has a corresponding *local* condition. Do this by comparing the sets of local and remote condition IDs, then delete any remote conditions without corresponding local IDs by sending DELETE requests to the API. The DELETE request would take the form of `https://api.eu.newrelic.com/v2/alerts_conditions/123456.json`.

## Creating a policy

Create a JSON file with `incident_preference` and `name` specified. The fields `id`, `created_at`, and `updated_at` will be filled in by New Relic, and subsequently the syncing process.

* `incident_preference` - decide whether an incident is raised for each condition (or condition target) in alert status or for the policy as a whole. Default is per-policy. If you wish default to be set, leave this field unspecified
* `name` - the name of the policy

Example:

```
{
    "incident_preference": "PER_CONDITION",
    "name": "User Service alerts"
}
```



