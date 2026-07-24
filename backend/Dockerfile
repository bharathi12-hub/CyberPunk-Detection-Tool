# CyberPunk Detection Tool — backend API
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the backend source
COPY . .

EXPOSE 3000

CMD ["node", "api/server.js"]
