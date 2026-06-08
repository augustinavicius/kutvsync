FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY setup.js ./
COPY certs/ ./certs/

ENV KU_USERNAME="" \
    KU_PASSWORD="" \
    GOOGLE_CLIENT_ID="" \
    GOOGLE_CLIENT_SECRET="" \
    GOOGLE_REFRESH_TOKEN="" \
    GOOGLE_CALENDAR_ID="primary" \
    TZ="Europe/Vilnius" \
    SYNC_INTERVAL_MINUTES="60" \
    LOG_LEVEL="info"

CMD ["node", "src/index.js"]
