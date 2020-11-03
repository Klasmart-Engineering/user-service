| Statements                | Branches                | Functions                | Lines                |
| ------------------------- | ----------------------- | ------------------------ | -------------------- |
| ![Statements](https://img.shields.io/badge/Coverage-35.23%25-red.svg) | ![Branches](https://img.shields.io/badge/Coverage-0.7%25-red.svg) | ![Functions](https://img.shields.io/badge/Coverage-48.46%25-red.svg) | ![Lines](https://img.shields.io/badge/Coverage-33.33%25-red.svg) |

# Setup

1. `docker run -d --name=postgres -p 5432:5432 -e POSTGRES_PASSWORD=kidsloop postgres`

npm i

# Restart

1. docker start postgres

2. npm start

# Testing

Create a database used for integration tests:

1. Make sure the postgres docker container is running.

2. `docker container exec -it postgres psql -U postgres -c "create database testdb;"`

Update the README coverage badges:

1. `npm run coverage`

2. `npm run make-badges`
