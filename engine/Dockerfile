FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

# Start the engine
CMD ["node", "dist/index.js"]
