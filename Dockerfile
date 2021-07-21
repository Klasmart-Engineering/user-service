FROM node:lts-alpine
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN export https_proxy=http://192.168.1.233:1081
RUN npm ci
RUN npm audit fix
COPY ./customTypings ./customTypings
COPY ./src ./src
COPY ./tsconfig.json .
ENV PORT=8080
EXPOSE 8080
CMD [ "npm", "start" ]
