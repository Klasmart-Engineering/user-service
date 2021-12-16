FROM node:lts-alpine AS base
WORKDIR /usr/src/app
COPY ./package*.json ./
COPY node_modules node_modules

FROM base AS build
COPY tsconfig*.json ./
COPY customTypings customTypings
COPY migrations migrations
COPY src src
COPY views views
RUN npm run build

FROM base as release
COPY --from=build /usr/src/app/dist/ .
COPY ./newrelic.js .
ENV PORT=8080
EXPOSE 8080
CMD [ "node", "src/main.js" ]
