# Node.js Auth Backend Dockerfile
FROM node:20-slim

WORKDIR /app

# Install dependencies (node_modules will be created inside container)
COPY package*.json ./
RUN npm install --production

# Copy source code (node_modules from host is ignored via .dockerignore)
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
