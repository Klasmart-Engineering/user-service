FROM node:lts-alpine
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN apk add --no-cache bash
RUN apk add curl
RUN npm ci
RUN npm audit fix
COPY ./customTypings ./customTypings
COPY ./src ./src
COPY ./tsconfig.json .
COPY ./wait-for-it.sh wait-for-it.sh
COPY ./waitforLocalstack1.sh waitforLocalstack1.sh
RUN chmod +x wait-for-it.sh
RUN chmod +x waitforLocalstack1.sh

ENV PORT=8080
EXPOSE 8080
CMD [ "npm", "start" ]
