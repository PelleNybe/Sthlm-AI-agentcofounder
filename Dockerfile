FROM node:22.19.0-bookworm-slim

WORKDIR /challenge
ENV npm_config_cache=/challenge/.npm-cache

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY app-template/package.json app-template/package-lock.json ./app-template/
RUN npm --prefix app-template ci --ignore-scripts

COPY . .
RUN npm run check \
    && mkdir -p output artifacts \
    && chown -R node:node /challenge

EXPOSE 3000
USER node

ENTRYPOINT ["npm", "run", "challenge", "--"]
