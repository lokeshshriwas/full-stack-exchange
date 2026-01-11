FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

# Expose API port
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]
