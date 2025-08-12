# AU Journey Backend - Digital Ocean Deployment Guide

## 🚀 Quick Start (Recommended)

### Option 1: Digital Ocean App Platform (Easiest)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add deployment configuration"
   git push origin main
   ```

2. **Create App on Digital Ocean**
   - Go to [Digital Ocean Apps](https://cloud.digitalocean.com/apps)
   - Click "Create App"
   - Select your GitHub repository
   - Use these settings:
     - **Service Type**: Web Service
     - **Build Command**: `npm ci`
     - **Run Command**: `npm start`
     - **HTTP Port**: `8080`

3. **Set Environment Variables**
   ```
   NODE_ENV=production
   PORT=8080
   REDIS_HOST=your-redis-host
   REDIS_PORT=15238
   REDIS_PASSWORD=your-redis-password
   REDIS_DB=0
   FRONTEND_URL=https://your-app.ondigitalocean.app
   ```

4. **Deploy** - Click "Create Resources" and wait 5-10 minutes

## 🛠 Advanced Deployment Options

### Option 2: Docker on Droplet

1. **Create Ubuntu 22.04 Droplet** ($6/month minimum)

2. **Set up server**:
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   
   # Install nginx
   sudo apt update
   sudo apt install nginx certbot python3-certbot-nginx
   ```

3. **Deploy application**:
   ```bash
   git clone your-repo-url
   cd au-journey-web-backend
   cp env.example .env
   # Edit .env with your values
   ./deploy.sh deploy
   ```

4. **Set up reverse proxy** (see full nginx config in deployment files)

### Option 3: GitHub Actions CI/CD

1. **Set GitHub Secrets**:
   - `DO_REGISTRY_TOKEN`: Digital Ocean registry token
   - `DO_REGISTRY_NAME`: Your registry name
   - `DO_HOST`: Droplet IP address
   - `DO_USERNAME`: SSH username (usually root)
   - `DO_SSH_KEY`: Private SSH key
   - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`
   - `FRONTEND_URL`

2. **Push to main branch** - Auto-deployment will trigger

## 📋 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `8080` |
| `REDIS_HOST` | Redis hostname | `redis-xxx.redis-cloud.com` |
| `REDIS_PORT` | Redis port | `15238` |
| `REDIS_PASSWORD` | Redis password | `your-password` |
| `REDIS_DB` | Redis database | `0` |
| `FRONTEND_URL` | Frontend URL | `https://your-frontend.com` |

## 🔍 Monitoring & Management

### Health Check
```bash
curl https://your-app.ondigitalocean.app/health
```

### Using Deployment Script
```bash
# Deploy application
./deploy.sh deploy

# Check status
./deploy.sh status

# View logs
./deploy.sh logs

# Restart application
./deploy.sh restart
```

### Docker Commands
```bash
# Check running containers
docker ps

# View logs
docker logs au-journey-backend

# Restart container
docker restart au-journey-backend

# Stop container
docker stop au-journey-backend
```

## 🚨 Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Verify Redis credentials in environment variables
   - Check Redis server status
   - Ensure firewall allows Redis port

2. **WebSocket Connection Issues**
   - Verify CORS configuration includes your frontend domain
   - Check if proxy supports WebSocket upgrade headers
   - Test WebSocket directly: `npm run test:websocket`

3. **Port Already in Use**
   ```bash
   # Find process using port 8080
   sudo lsof -i :8080
   
   # Kill process
   sudo kill -9 <PID>
   ```

4. **Container Health Check Failing**
   ```bash
   # Check container logs
   docker logs au-journey-backend
   
   # Test health endpoint
   docker exec au-journey-backend node healthcheck.js
   ```

### Logs Location
- **App Platform**: View in Digital Ocean dashboard
- **Docker**: `docker logs au-journey-backend`
- **System**: `/var/log/nginx/` for nginx logs

## 📈 Scaling & Performance

### App Platform Scaling
- **Horizontal**: Increase instance count in dashboard
- **Vertical**: Upgrade to Professional plan ($12/month)

### Droplet Scaling
- **Resize Droplet**: Power off → Resize → Power on
- **Load Balancer**: Add multiple droplets behind DO Load Balancer

### Database Optimization
- **Redis Clustering**: For high availability
- **Connection Pooling**: Already implemented with ioredis
- **Redis Memory Optimization**: Set appropriate maxmemory policies

## 🔒 Security Checklist

- ✅ Environment variables (not hardcoded)
- ✅ HTTPS/SSL certificates
- ✅ CORS properly configured
- ✅ Non-root user in Docker
- ✅ Health checks enabled
- ✅ Firewall configured (if using droplet)
- ✅ Regular security updates

## 💰 Cost Estimation

| Option | Monthly Cost | Features |
|--------|-------------|----------|
| App Platform Basic | $5 | Auto-scaling, HTTPS, easy deploys |
| App Platform Pro | $12 | More resources, better performance |
| Droplet + Redis | $12+ | Full control, custom configuration |

## 📞 Support

For deployment issues:
1. Check health endpoint: `/health`
2. Review application logs
3. Verify environment variables
4. Test Redis connectivity
5. Check WebSocket functionality: `npm run test:websocket`
