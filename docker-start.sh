#!/bin/bash

# Quick start script for tangerin Docker container

echo "🍊 Starting tangerin Docker container..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "   Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    echo "   Please install Docker Compose"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found"
    echo "   Creating .env file..."
    cat > .env << EOF
OPENAI_API_KEY=your-api-key-here
PENDING_DIR=./src/content/1.pending
WORKING_DIR=./src/content/2.working
DONE_DIR=./src/content/3.done
TEXT_LANG=eng

# Authentication
JWT_SECRET=your-secret-key-change-this-to-something-secure
AUTH_PASSWORD=tangerin2024
EOF
    echo "   ✅ Created .env file"
    echo "   ⚠️  Please edit .env and add your OpenAI API key"
    echo ""
fi

# Create content directories if they don't exist
echo "📁 Creating content directories..."
mkdir -p src/content/1.pending
mkdir -p src/content/2.working/text
mkdir -p src/content/2.working/audio
mkdir -p src/content/3.done
echo "   ✅ Directories created"
echo ""

# Build and start container
echo "🐳 Building and starting Docker container..."
docker-compose up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ tangerin is now running!"
    echo ""
    echo "🌐 Access at: http://localhost:8011"
    echo ""
    echo "📋 Useful commands:"
    echo "   View logs:    docker-compose logs -f"
    echo "   Stop:         docker-compose down"
    echo "   Restart:      docker-compose restart"
    echo "   Status:       docker-compose ps"
    echo ""
else
    echo ""
    echo "❌ Failed to start container"
    echo "   Check the error messages above"
    exit 1
fi

