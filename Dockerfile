FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENV NODE_ENV=production
ENV MCP_TRANSPORT=stdio

CMD ["node", "dist/index.js"]
