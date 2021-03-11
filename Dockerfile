FROM node:lts-alpine
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN npm i --production
RUN npm audit fix --production
RUN npm i ts-node
COPY ./src ./src
COPY ./tsconfig.json .
COPY ./schema.graphql .
ENV PORT=8080
EXPOSE 8080
CMD [ "npm", "start" ]