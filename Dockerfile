FROM node:lts-alpine AS base
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN npm install -g npm@7.22.0

FROM base AS build
RUN npm ci
COPY tsconfig*.json ./
COPY customTypings customTypings
COPY migrations migrations
COPY src src
COPY views views
RUN npm run build

FROM base as deps

# Disable husky git hooks
# https://typicode.github.io/husky/#/?id=disable-husky-in-cidocker
RUN npm set-script prepare ""
RUN npm ci --only=production

FROM base as release
COPY --from=deps /usr/src/app/node_modules node_modules
COPY --from=build /usr/src/app/dist/ .
COPY ./newrelic.js .
ENV PORT=8080
EXPOSE 8080
CMD [ "node", "src/main.js" ]
