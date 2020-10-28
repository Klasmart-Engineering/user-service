# Setup
docker run -d --name=postgres -p 5432:5432 -e POSTGRES_PASSWORD=kidsloop -d postgres
npm i

# Restart
docker start postgres
npm start