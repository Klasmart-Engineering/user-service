# Setup
1. `docker run -d --name=postgres -p 5432:5432 -e POSTGRES_PASSWORD=kidsloop -d postgres`

2. `npm i`

3. Create a `.env` file with AWS credentials. Use `.env-sample` to do so.

# Restart


1. docker start postgres

2. npm start