#Setup
docker run --name postgres --net=host -e POSTGRES_PASSWORD=kidsloop -d postgres
npm i

#Restart
docker start postgres
npm start