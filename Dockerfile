###################
# Build
###################

ARG NODE_VERSION=lts

FROM node:${NODE_VERSION}-alpine as builder

WORKDIR /src

COPY package.json package-lock.json tsconfig.json ./
COPY ./src ./src

RUN npm install && \
    npm run build

###################
# PRODUCTION
###################

FROM node:lts-alpine

ENV NODE_ENV=production
ENV LINODE_ACCESS_TOKEN=
ENV LINODE_DOMAIN_ID=
ENV HOSTNAMES=
ENV RECORD_TYPES=
ENV CRON_TIME=
ENV LOG_LEVEL=

WORKDIR /src

COPY --from=builder /src/package.json /src/package-lock.json ./
COPY --from=builder /src/dist ./dist
RUN npm install --production

ENTRYPOINT ["node", "dist/index.js"]
