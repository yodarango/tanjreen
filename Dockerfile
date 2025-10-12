# Use Node.js LTS version
FROM node:18-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create content directories
RUN mkdir -p src/content/1.pending \
    src/content/2.working/text \
    src/content/2.working/audio \
    src/content/3.done

# Expose port 8011
EXPOSE 8011

# Set environment variable for port
ENV PORT=8011

# Start the application
CMD ["node", "server.mjs"]

