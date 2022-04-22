# RFC-066

## Synopsis

Open credo created [a system for running load tests](https://calmisland.atlassian.net/wiki/spaces/OC/pages/2498036145/Open+Credo) against kidsloop services.
But now we're taking ownership of [the user-service part](https://bitbucket.org/calmisland/opencredo-loadtest/src/main/kidsloop-user-service/).
This RFC aims to define what we want this user-service load testing setup to look like.

## Background

The open credo system had 2 parts:

* The environments that were being load tested
  * deployed to `hub.kidskube-loadtest.kidsloop.live` and `hub.loadtest.kidsloop.live`
* [The system that ran the tests](https://bitbucket.org/calmisland/opencredo-loadtest/src/main/)
  * [K6](https://k6.io/), but later [K6 in EC2](https://calmisland.atlassian.net/wiki/spaces/OC/pages/2498396810/Running+K6+in+an+EC2+instance)

[The infrastructure team do not have any current plans for a system to run load tests from](https://kidsloop.slack.com/archives/C021QCLAESZ/p1650623050697549), so we will need to come up with our own, or request that they do.

[hub.kidskube-loadtest.kidsloop.live](https://kidsloop.slack.com/archives/C021QCLAESZ/p1650624209989459) will be deprecated, but [hub.loadtest.kidsloop.live](https://kidsloop.slack.com/archives/C021QCLAESZ/p1650624223001789) will be kept up to date via Argo CD once `istio` is rolled out.

These environments were seeded with data by the infrastructure and testing teams.

The load testing tests currently focus on student interactions and queries rather then mutations - meaning they don't currently change the DBs data.

Some base assumptions about what we want from a load testing setup:

* Prove that our default production setup has good enough telemetry to identify performance issues
  * If they are not good enough to measure the results of a load test then we should improve them
    * We can use the K6 data to identify gaps in our server side telemetry
  * Until increasing the detail of telemetry is too expensive (in cost or performance) but we are not near that trade of yet
* Prove that our application has a minimal level of performance for the user cases we test
* The K6 tests report their test results to new relic
* We primarily care about testing the performance of the user service specifically
* We want load testing results to be reproducible
  * And to track how they change across builds
* We want to increase the scope of the load tests over time
  * to include mutations for example

## Proposal

We create a new standalone ECS service containing:

* The user-service instance
  * An EC2 application instance (using latest image)
  * An RDS Postgres DB instance
* An K6 EC2 instance

On merging to the user-service repository, CI should kick of an action to:

* update the application instance to the latest image version
  * this could happen automatically when the image is pushed, same as alpha dev
* Build and publish K6 EC2 image
* Update the K6 EC2 instance to the latest image version
  * this could happen automatically when the image is pushed, same as alpha dev
* The K6 EC2 instance then:
  * Connects directly to the DB and wipes it
  * Populates the database via API calls
    * we could connect to the DB directly, but it feels like doing it via the API would more realistic and itself provides useful data
  * Run the tests for 10 minutes (because that's the time open credo were using)

If a new merge occurs while the load tests are running, it is ok if a running load test is interrupted. Consider a complete load-test best effort, given how often we merge 10 minutes should allow tests to complete often.

We can then use our standard new relic logs and metrics to see the performance impact of each PR.

To support this, the user-service load tests and K6 image definition would live in our repo as well.

### Why not runs tests against hub.kidskube-loadtest.kidsloop.live?

* Other teams will be using this, meaning we cannot wipe the DB arbitrarily
  * Which limits our ability to have identical setups across load tests
* We will have to schedule tests to not overlap with when other teams running their own tests
  * which means no running them in CI :(

The value of a complete production setup of all services that `hub.kidskube-loadtest.kidsloop.live` provides is that we can see the impact on the user-service from how it is used by other systems.
That's super useful - maybe CMS calls us in a way we didn't optimize for.
But by being more integrated it also less flexible for us [test pyramid problems](https://martinfowler.com/articles/practical-test-pyramid.html#TheTestPyramid).

### Why should we keep the user-service load tests in the user-service repo

These tests will be aimed at testing the user service specifically, and so will be of interest to us over any other team.
For tests aimed at `hub.kidskube-loadtest.kidsloop.live` or replicating more complete user interactions a shared repo makes more sense.

There could be value in sharing a K6 base image and a general load-test framework package across teams. And a repo could be made to support those.

But this would still not contain our tests itself.

## Out of scope

* How we will store the config for this environment
  * We'll need to ask infra this, especially in an istio world
  * There's nothing about the infrastructure setup that is novel

## Appendix

https://calmisland.atlassian.net/wiki/spaces/OC/pages/2498396810/Running+K6+in+an+EC2+instance
https://calmisland.atlassian.net/wiki/spaces/OC/pages/2498036145/Open+Credo
https://calmisland.atlassian.net/wiki/spaces/UserService/pages/2535524351/Local+Loadtesting+-+Permission+Checks+Jan+2022

## Decision

|     Reviewer     |  Status  | Color  |
|------------------|----------|--------|
| Toghrul          | Pending  |   🟡   |
| Oliver           | Pending  |   🟡   |
| Matthew          | Pending  |   🟡   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Sam              | Pending  |   🟡   |
| Raphael          | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Pending  |   🟡   |
