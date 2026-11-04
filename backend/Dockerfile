FROM node:24.21.0-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node migrations ./migrations
RUN mkdir -p /home/node/fleet-photos && chown node:node /home/node/fleet-photos
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
