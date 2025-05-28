# Image used for build
FROM node:20.18 AS base

RUN npm i -g pnpm

FROM base AS dependencies
WORKDIR /usr/src/app

# The ./ refers to WORKDIR where the files will be copied
COPY package.json pnpm-lock.yaml ./ 

RUN pnpm install

FROM base AS build
WORKDIR /usr/src/app

# Copy the rest of the files
COPY . . 
COPY --from=dependencies /usr/src/app/node_modules ./node_modules

RUN pnpm build
# To ignore dev dependencies
RUN pnpm prune --prod

FROM cgr.dev/chainguard/node:latest AS deploy

# To use user node, rootless concept
USER 1000

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./package.json

# Database
ENV DATABASE_URL="postgresql://docker:docker@localhost:5432/upload"

EXPOSE 3333

CMD ["dist/infra/http/server.cjs"]