FROM node:14
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN npm install --unsafe-perm
COPY ./src ./src
COPY ./tsconfig.json .
COPY ./schema.graphql .
ENV PORT=8080
EXPOSE 8080
CMD [ "npm", "start" ]