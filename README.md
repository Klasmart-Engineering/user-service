| Statements                | Branches                | Functions                | Lines                |
| ------------------------- | ----------------------- | ------------------------ | -------------------- |
| ![Statements](https://img.shields.io/badge/Coverage-68.92%25-red.svg) | ![Branches](https://img.shields.io/badge/Coverage-37.41%25-red.svg) | ![Functions](https://img.shields.io/badge/Coverage-67.04%25-red.svg) | ![Lines](https://img.shields.io/badge/Coverage-71.9%25-red.svg) |

# Setup

- `docker run -d --name=postgres -p 5432:5432 -e POSTGRES_PASSWORD=kidsloop postgres`
- `npm i`

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

- `npm run test:unit`
- `npm run test:integration`
- `npm test` (to run all)

Optionally, install the [Mocha Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-mocha-test-adapter) VSCode extension for a nice UI and more fine-grained control.
