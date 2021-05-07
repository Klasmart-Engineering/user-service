| Statements                                                            | Branches                                                            | Functions                                                            | Lines                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| ![Statements](https://img.shields.io/badge/Coverage-68.92%25-red.svg) | ![Branches](https://img.shields.io/badge/Coverage-37.41%25-red.svg) | ![Functions](https://img.shields.io/badge/Coverage-67.04%25-red.svg) | ![Lines](https://img.shields.io/badge/Coverage-71.9%25-red.svg) |

# Setup

-   `docker run -d --name=postgres -p 5432:5432 -e POSTGRES_PASSWORD=kidsloop postgres`
-   `npm i`

# Restart

1. `docker start postgres`
2. `npm start`

# Testing

Create a database used for integration tests:

1. Make sure the postgres docker container is running.
2. `docker container exec -it postgres psql -U postgres -c "create database testdb;"`

Update the README coverage badges:

1. `npm run coverage`
2. `npm run make-badges`

Running tests during development:

-   `npm run test:unit`
-   `npm run test:integration`
-   `npm test` (to run all)

Optionally, install the [Mocha Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-mocha-test-adapter) VSCode extension for a nice UI and more fine-grained control.

Issues with using database with "npm start"

The database is created without the default permissions. To do any thing useful you need create them.

You need to create a user with `Admin` permissions (by adding your email to this [list](https://bitbucket-ci/calmisland/kidsloop-user-service/src/master/src/permissions/userPermissions.ts#userPermissions.ts-23), please remember to restart your project) and using your JWT token (you can get the token by signing in [global hub](https://hub.kidsloop.net)) call the endpoint:

```
mutation {
  createOrUpateSystemEntities
}
```

# Connecting to a locally running frontend
- Setup the the frontend on your machiine
  - Checkout the `test/release` branch
  - Follow installation instructions in the readme
- Start the backend in local mode: `npm run start:local`
- Start the frontend in local mode: `npm run start:local`

# Diagnosing

## Via TypeORM

Enable the `DATABASE_LOGGING` environment variable to enable TypeORM logging, e.g. `DATABASE_LOGGING=true npm start`

## Via Docker

It is also possible to look at the postgres logs from the docker container

(I don't recommend doing this but in extreme situations)

Replace the docker currrent container with another that logs output

1. `docker container stop postgres`
2. `docker system prune -f --volumes`

Then build a container that logs

3. `docker run -d --name=postgres -p 5432:5432 -e POSTGRES_PASSWORD=kidsloop postgres postgres -c log_statement=all`
4. `docker start postgres`
5. `docker container exec -it postgres psql -U postgres -c "create database testdb;"`
6. Open a new terminal window perhaps in a different folder
7. `docker logs -tf postgres 1>postgres.log 2>postgres.err &`
8. `tail -f postgress.err`

A vast amount of postgres sql commands will be in the postgres.err file.

You could just run the test that is causing issues.

Even so you may need to resort to tools like grep and less to find the commands of interest

# How to

## Test CSV upload with Postman

Make a request with below body (`form-data`), please replace `file_path` with your real file path.

```
{
  "operations": "{\"query\":\"mutation UploadAgeRangesFromCSV($file: Upload!) {\n uploadAgeRangesFromCSV(file: $file)\n{filename, mimetype, encoding}}\"}",
  "map": "{\"0\": [\"variables.file\"]}",
  0: "file_path",
}
```

Remember include `Authorization` with JWT token in request's header.
