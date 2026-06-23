FROM node:18-alpine

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# Expose production port
EXPOSE 3000

# Start server
CMD ["npm", "run", "start"]
