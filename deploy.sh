#!/bin/bash

# AU Journey Backend Deployment Script for Digital Ocean
# Usage: ./deploy.sh [build|deploy|restart|logs|status]

set -e

# Configuration
IMAGE_NAME="au-journey-backend"
CONTAINER_NAME="au-journey-backend"
PORT="8080"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."
    docker build -t $IMAGE_NAME .
    log_success "Docker image built successfully!"
}

# Deploy application
deploy_app() {
    log_info "Deploying AU Journey Backend..."
    
    # Stop existing container if running
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        log_info "Stopping existing container..."
        docker stop $CONTAINER_NAME
    fi
    
    # Remove existing container if exists
    if docker ps -aq -f name=$CONTAINER_NAME | grep -q .; then
        log_info "Removing existing container..."
        docker rm $CONTAINER_NAME
    fi
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        log_warning ".env file not found. Using default configuration."
        log_warning "Please create .env file with your production settings."
    fi
    
    # Run new container
    log_info "Starting new container..."
    if [ -f .env ]; then
        docker run -d \
            --name $CONTAINER_NAME \
            --restart unless-stopped \
            -p $PORT:8080 \
            --env-file .env \
            $IMAGE_NAME
    else
        docker run -d \
            --name $CONTAINER_NAME \
            --restart unless-stopped \
            -p $PORT:8080 \
            -e NODE_ENV=production \
            -e PORT=8080 \
            $IMAGE_NAME
    fi
    
    log_success "Application deployed successfully!"
    log_info "Application is running on http://localhost:$PORT"
    log_info "Health check: http://localhost:$PORT/health"
}

# Restart application
restart_app() {
    log_info "Restarting application..."
    docker restart $CONTAINER_NAME
    log_success "Application restarted successfully!"
}

# Show application logs
show_logs() {
    log_info "Showing application logs..."
    docker logs -f $CONTAINER_NAME
}

# Show application status
show_status() {
    log_info "Application Status:"
    echo "===================="
    
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        log_success "Container is running"
        echo ""
        echo "Container Details:"
        docker ps -f name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo "Resource Usage:"
        docker stats $CONTAINER_NAME --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
        echo ""
        echo "Health Check:"
        curl -s http://localhost:$PORT/health | jq . || echo "Health check endpoint not responding"
    else
        log_error "Container is not running"
    fi
}

# Main script
case "${1:-}" in
    "build")
        check_docker
        build_image
        ;;
    "deploy")
        check_docker
        build_image
        deploy_app
        ;;
    "restart")
        check_docker
        restart_app
        ;;
    "logs")
        check_docker
        show_logs
        ;;
    "status")
        check_docker
        show_status
        ;;
    *)
        echo "AU Journey Backend Deployment Script"
        echo "Usage: $0 [build|deploy|restart|logs|status]"
        echo ""
        echo "Commands:"
        echo "  build   - Build Docker image"
        echo "  deploy  - Build and deploy application"
        echo "  restart - Restart running application"
        echo "  logs    - Show application logs"
        echo "  status  - Show application status"
        echo ""
        echo "Examples:"
        echo "  $0 deploy     # Build and deploy the application"
        echo "  $0 logs       # View application logs"
        echo "  $0 status     # Check application status"
        ;;
esac
