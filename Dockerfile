###################
# Build
###################

ARG NODE_VERSION=lts

FROM node:${NODE_VERSION}-alpine as builder

WORKDIR /src

COPY package.json package-lock.json tsconfig.json rollup.config.mjs ./
COPY ./src ./src

RUN npm install && \
    npm run build && \
    npm run bundle

###################
# PRODUCTION
###################

FROM alpine:latest

ENV NODE_ENV=production
ENV LINODE_ACCESS_TOKEN=
ENV LINODE_DOMAIN_ID=
ENV HOSTNAMES=
ENV RECORD_TYPES=
ENV CRON_TIME=
ENV LOG_LEVEL=

RUN apk --no-cache add nodejs

WORKDIR /src

COPY --from=builder /src/dist/bundle.min.js .

ENTRYPOINT ["node", "bundle.min.js"]
