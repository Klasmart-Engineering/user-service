# RFC-063

## **Synopsis**

What we call _migrations_ can be split into _data migrations_ and _schema migrations_. The current deployment and testing system we have in place is well-suited to schema migrations but has some limitations with data migrations which will only get worse as our platform grows. We need a new deployment pipeline for data migrations.

Implementing such a pipeline will be quite important in our scaling efforts since we might find ourselves using data migrations quite frequently. Presumably, other teams will need to perform similar operations on their prod dbs, so the objective here is to set company-wide standard for data migrations.

## **Some facts about how our migrations work**

* We push schema and data changes through migrations, which are basically just a 'package' of sql queries.

* Migrations run in a specific order, from oldest to newest. They contain a timestamp in their names to ensure this.

* The final database schema is just a sum of the changes made by each migration.

* A migration which modifies the database schema will typically be accompanied with the equivalent change in the typeorm entities, thereby keeping them in sync.

* There is nothing enforcing a strict equivalence between the typeorm entities in our code and the database schema which it runs on. We rely on migration tests the check this.

* Migration tests aim to verify that:
  * the typeorm entities and the db schema are in sync
  * the database behaves as expected given the latest changes

## **Why should we distinguish data and schema migrations**

### **Conceptual difference**

A schema migration is a step in building the final schema of our database, while a data migration is fixing a problem at a specific point in time.

### **Differences in testing**

It makes sense to run schema migration tests frequently, or at least every time the db schema or typeorm entities change. By contrast, data migrations only need to be tested once: right after they are run.

#### **Testing schema migrations**

* To test a schema migration, we should first run _all_ migrations, including later ones.
  * reason: we wish the final state of the db schema, rather than an intermediate one.
* Tests will be working with the latest version of our schema.
* DB schema should be compatible with latest typeorm entities.
* Tests need to be modified when a later mutation brings a breaking change.

---
**Note**: Once all migrations have run, the database schema should be in sync with typeorm entities. Migration tests aim to verify that this is always true.

---

#### **Testing data migrations**

* To test a data migration, we should first run all _previous_ migrations, populate the database, and then run that migration.
  * reason: a data migration runs when the db's schema is in a particular state which is not necessarily the most up-to-date. We want to to test that, at the time when the migration ran, the db's data was modified in the expected manner.
* Tests will be working with the database schema as it was directly after the migration runs.
* If the migration is not the latest one, tests will not use the most up-to-date schema.
* DB schema could be incompatible with latest typeorm entities.
* Where typeorm entities are incompatible with the schema, we write queries in raw SQL rather than with typeorm's entity manager.

### **Performance**

A data migration is potentially quite a costly operation, on a large database it could take a significant amount of time to run. Therefore running it separately would help mitigate that, and would speed up deployments. A [recent issue](https://calmisland.atlassian.net/wiki/spaces/UserService/pages/2624258246/Postmortem+for+Release+Issue+on+Migration+script) could have been avoided with separate data migrations: a large data migration was deployed to a production environment but would timeout when it was run. This prevented the startup of the user-service. With data migrations decoupled from startup, this would have been a less urgent problem.

## **Proposal: run data migrations through CLI**

I am proposing to deploy data migrations in the applications, but have them separated from schema migrations. We would have a directory structure which runs something like this:

```tree
migrations/
  schema/
  data/
```

However, data migrations would not run on startup, they would have to be manually invoked using the **typeorm CLI**.

Benefits:

* Deploying data migration on selected environment only
* Choosing when to run expensive data migrations to reduce the load on our system
* Relatively simple to implement

To implement this we need to:

* Store data migrations in a separate file (see directory structure above)
* Figure out a way to only run migrations defined in `migrations/schema`
  * idea: in db config point migrations to `migrations/schema`, and check whether or not this prevents data migrations from being run
* Set up a command to run a data migration when passing its name
  * idea: we could have some logic to make sure a data migration can only run once
* Have a system in place to ensure that data migrations run on all prod environments
  * idea: we could use new relic to flag which migrations did not run

## **Annex: discarded proposals**

### **Manual deployment**

* Send sql query to SRE for them to run on all relevant prod DBs.
* Perform sanity checks on the database to make sure the changes are correct.

This was proposed as more of a temporary solution, but it would require too much work & coordination to implement this would have to be carried out on each environment. Since this requires repetitive  work, it is quite error prone. It could still be viable if a change needs to be made on a single environment, although even then we would want to have visibility of what changes where made to our databases.

### **Deployed in the application, runs automatically but separately from schema migrations**

* Data migrations would no longer have to run for an app instance to start up successfully.
* We would check that old instances of the app are no longer running before starting data migrations.
* Data migrations would always run after schema migrations, so we will not necessarily know which schema the db uses when they run. We could get around this by performing schema checks before running the migration, and skipping/failing if they fail (e.g. if a migration needs to update a column which no longer exists, we can check for that and simply skip the `UPDATE`).
* Data migrations can only run once.

This solution presents is quite aspirational, we are not sure we are able to achieve it and could require a significant amount of work.

## **Decision**

|     Reviewer     |  Status  | Color  |
|------------------|----------|-------:|
| Oliver           | Pending  |   🟡   |
| Matthew          | Pending  |   🟡   |
| Richard          | Pending  |   🟡   |
| Matt             | Pending  |   🟡   |
| Toghrul          | Pending  |   🟡   |
| Marlon           | Pending  |   🟡   |
| Nicholas         | Pending  |   🟡   |
