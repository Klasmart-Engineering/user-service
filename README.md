# Admin Service

| Statements                                                            | Branches                                                            | Functions                                                            | Lines                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| ![Statements](https://img.shields.io/badge/statements-92.98%25-brightgreen.svg) | ![Branches](https://img.shields.io/badge/branches-82.1%25-yellow.svg) | ![Functions](https://img.shields.io/badge/functions-91.79%25-brightgreen.svg) | ![Lines](https://img.shields.io/badge/lines-92.85%25-brightgreen.svg) |

Welcome to the admin service (formerly user service)!

- Getting started? Follow installation & running instructions below.
- Questions? Head over to [#ask-user-service](https://app.slack.com/client/T02SSP0AM/C02LP6QAQGZ) on Slack.

<br>

## Installation

Install postgres:

- `docker run -d --name=postgres -p 5432:5432 -e POSTGRES_PASSWORD=kidsloop postgres`

Install dependencies:

- `npm i`

Setup environment variables:

- Create a `.env` file by copying the contents of `.env.example`

<br>

## Running

Start postgres:

- `docker start postgres`

Start the application:

- `npm start`
- or, `npm run start:local` for an HTTPS server

Getting started for the first time? Following the [onboarding doc](./documents/howto/onboarding.md).

<br>

## Testing

### **Update the README coverage badges**

1. `npm run coverage`
2. `npm run make-badges`

### **Running tests unit and integration during development**

Make sure the postgres docker container is running, if you are not using the [docker-compose](<(#docker)>)

```bash
docker container exec -it postgres psql -U postgres -c "create database testdb;"
```

- `npm run test:unit`
- `npm run test:integration`
- `npm test` (to run unit & integration, for now we have to run acceptance separately)

Optionally, install the [Mocha Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-mocha-test-adapter) VSCode extension for a nice UI and more fine-grained control.

### **Running tests acceptance during development**

Stop the `postgres` container, then start the `kidsloop-user-service` container stack. If you don't have this in your Docker view yet, run `docker-compose up` to pull it.

- `npm run test:acceptance`

With docker-compose a volume maps the your `./dist` to the code directory of the image.
This allows you to update the code running without rebuilding the image, just rebuild the code and restart the container:

```bash
npm run-script build
# get the container ID:
# $sudo docker ps --format "table {{.ID}}\t{{.Image}}"| grep kidsloop
# 1786e6713dac   kidsloop-user-service_kidsloop-user-service
sudo docker restart 1786e6713dac
```

<br>

## Connecting to a locally running frontend

### **Prerequisites**

#### 1 - Your local DB contains a user record for your account on the auth service

- Launch hub.alpha.kidsloop.net
- Inspect requests to the user-service to find your auth token
- Find your user ID and email from the token using jwt.io
- Add a new user on your local DB with this user ID and email

```shell
docker exec -it postgres psql -U postgres
```

```shell
INSERT INTO "user"(user_id, email) VALUES('<my-user-id>', '<my-email>');
```

#### 2 - Your user has been assigned to a organisation

- Create an organisation on your local DB for your user

```graphql
mutation {
  user(user_id: <my-user-id>) {
    createOrganization(organization_name:"my-org") {
      organization_id
    }
  }
}
```

#### 3 - You switched to local frontend environment variables settings in `.env`

```dotenv
NODE_ENV=dev
DOMAIN=fe.alpha.kidsloop.net
```

### **Starting local development servers**

- Follow [instructions to set up the frontend on your machine](https://bitbucket.org/calmisland/kidsloop-hub-frontend/src/dev/README.md)
- Start the backend in local mode: `npm run start:local`
- Start the frontend: `npm run start`
- Open the frontend in your browser and login using your credentials from the process above
- Note: you may need to allow the insecure hosts (frontend and backend) in your browser when launching for the first time

### **Docker**

You can also run the application with its dependencies through a docker-compose. For this just run:

```bash
docker-compose up
```

Finally, you can list the items in the bucket with the regular client:

```bash
aws s3 ls s3://kidsloop-alpha-account-asset-objects/ --endpoint http://localhost:456
```

<br>

## Diagnosing

### **Via TypeORM**

Enable environment variable `DATABASE_LOGGING` and set environment variable `LOG_LEVEL` to `debug` for enabling TypeORM logging, e.g. `DATABASE_LOGGING=true LOG_LEVEL=debug npm start`

### **Via Docker**

It is also possible to look at the postgres logs from the docker container

(I don't recommend doing this but in extreme situations)

Replace the docker current container with another that logs output

1. `docker container stop postgres`
2. `docker system prune -f --volumes`

Then build a container that logs

1. `docker run -d --name=postgres -p 5432:5432 -e POSTGRES_PASSWORD=kidsloop postgres postgres -c log_statement=all`
2. `docker start postgres`
3. `docker container exec -it postgres psql -U postgres -c "create database testdb;"`
4. Open a new terminal window perhaps in a different folder
5. `docker logs -tf postgres 1>postgres.log 2>postgres.err &`
6. `tail -f postgress.err`

A vast amount of postgres sql commands will be in the postgres.err file.

You could just run the test that is causing issues.

Even so you may need to resort to tools like grep and less to find the commands of interest

<br>

## How to

### **Test CSV upload with Postman**

Make a request with below body (`form-data`), please replace `file_path` with your real file path.

```json
{
  "operations": "{\"query\":\"mutation UploadAgeRangesFromCSV($file: Upload!) {\n uploadAgeRangesFromCSV(file: $file)\n{filename, mimetype, encoding}}\"}",
  "map": "{\"0\": [\"variables.file\"]}",
  0: "file_path",
}
```

Remember include `Authorization` with JWT token in request's header.

### **Create a database migration**

The user-service uses [TypeORM migrations](https://github.com/typeorm/typeorm/blob/master/docs/migrations.md) for managing database schema changes. If you need to change the database schema or modify existing data, you can create a new migration:

- Make the required schema changes
- Use the TypeORM CLI to create a migration file: `npm run typeorm migration:create -- -n <MigrationName>`
- Implement the migration logic in the `up` method of the migration file and the rollback logic in the `down` method
- Start the application and verify that the migration has run as expected

TypeORM can also attempt to automatically generate SQL required for migrations:

- Run `npm run typeorm migration:generate -- -n <MigrationName>`
- Check the generated SQL _very_ carefully and make any required changes
- Note that only schema changes are generated - any changes to existing data will require manual migration

### **Testing database migrations**

The migration will only ever run once, so if you need to rerun it during development, you need to:

- Restore the database to it's original state
- Delete the corresponding migration row from the `migrations` Postgres table
- Rerun the application

### **Fill the database with fake data**

Customize `tests/populateDatabase.ts` to create whatever entities you need in the database.

Then run it:

```bash
# start the database AND have the application bootstrap the database
docker-compose up
npm run-script populate-database
```

If you create a very large number of entities and want to save them to the database all at once
if might be useful to run node with a higher memory limit:

```bash
npm run-script populate-database-extra-memory
```

### **Add default entities and structures**

Default entities are defined in [src/initializers](./src/initializers/). To add a new entry,
add it to the dictionary contained in the entity's file. You will need to generate a
random UUID yourself, using a tool like
[this one](https://gchq.github.io/CyberChef/#recipe=Generate_UUID()).

<br>

## Useful Tools

- [VSCode](https://code.visualstudio.com/), for a feature rich development environment
- [Postman](https://www.postman.com/), for testing API requests
- [Postico](https://eggerapps.at/postico/), for working with Postgres databases on macOS
