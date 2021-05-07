FROM node:lts-alpine
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN npm ci
RUN npm audit fix
COPY ./src ./src
COPY ./tsconfig.json .
ENV PORT=8080
EXPOSE 8080
CMD [ "npm", "start" ]
