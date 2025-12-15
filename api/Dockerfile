FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src ./src

EXPOSE 3000

ENV NODE_ENV=production
ENV DB_LATENCY_MS=10
ENV DEGRADATION_THRESHOLD=100
ENV RATE_LIMIT=1000

CMD ["npm", "start"]
