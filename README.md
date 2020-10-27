#Setup
docker run -d --name=postgres -p 127.0.0.1:5432:5432 -e POSTGRES_PASSWORD=kidsloop -d postgres
npm i

#Restart
docker start postgres
npm start