FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY setup.js ./
COPY certs/ ./certs/

CMD ["node", "src/index.js"]
