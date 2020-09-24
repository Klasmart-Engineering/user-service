#Setup
docker run -d --name=cassandra1 --net=host cassandra
npm i

#Restart
docker start cassandra1
npm start