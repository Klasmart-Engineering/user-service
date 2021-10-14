FROM node:lts-alpine AS base
WORKDIR /usr/src/app
COPY ./package*.json ./

FROM base AS build
RUN npm ci
RUN npm audit fix
COPY tsconfig*.json ./
COPY customTypings customTypings
COPY migrations migrations
COPY src src
RUN npm run build

FROM base as deps
RUN npm ci --only=production
RUN npm audit fix --only=production

FROM base as release
COPY --from=deps /usr/src/app/node_modules node_modules
COPY --from=build /usr/src/app/dist/ .
COPY ./newrelic.js .
ENV PORT=8080
EXPOSE 8080
CMD [ "node", "src/main.js" ]
