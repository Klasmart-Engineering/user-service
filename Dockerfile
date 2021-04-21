FROM node:14
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN npm install -g npm@7.7.4
RUN npm i
COPY ./src ./src
COPY ./tsconfig.json .
ENV PORT=8080
EXPOSE 8080
CMD [ "npm", "start" ]
