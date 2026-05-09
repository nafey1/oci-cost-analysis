FROM node:22-slim

ENV NODE_ENV=production
ENV OCI_COST_DATA_DIR=/app/data
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY README.md ./

RUN mkdir -p /app/data && chown -R node:node /app/data

USER node
EXPOSE 3000

CMD ["node", "src/server.js"]
