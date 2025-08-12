// Production server for DigitalOcean deployment
import express from 'express';
import Redis from 'ioredis';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://localhost:5173",
      process.env.FRONTEND_URL || "http://localhost:5173",
      // Add DigitalOcean domains
      /.*\.ondigitalocean\.app$/
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});
const PORT = process.env.PORT || 8080;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Redis configuration - use environment variables in production
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis-15238.crce178.ap-east-1-1.ec2.redns.redis-cloud.com',
  port: parseInt(process.env.REDIS_PORT) || 15238,
  password: process.env.REDIS_PASSWORD || 'HOwS9Ta53CidWxys59VlS51v2yp88tY9',
  db: parseInt(process.env.REDIS_DB) || 0,
  retryDelayOnFailover: 1000,
  maxRetriesPerRequest: 3,
  keepAlive: 30000,
  connectTimeout: 60000,
  lazyConnect: true
};

console.log('🔧 Starting AU Journey Web Server...');
console.log('📍 Redis Config:', {
  host: redisConfig.host,
  port: redisConfig.port,
  db: redisConfig.db
});

// Broadcast GPS data to all connected WebSocket clients
function broadcastGPSData(gpsData) {
  io.emit('gps-data-update', gpsData);
  console.log('📡 Broadcasted GPS data to', io.engine.clientsCount, 'connected clients');
}

// Monitor Redis for GPS data changes using polling
let lastGPSData = null;
let gpsMonitoringInterval = null;

function startRedisGPSMonitoring() {
  if (!redis || !isRedisConnected) {
    console.log('⚠️ Cannot start Redis GPS monitoring - Redis not connected');
    return;
  }
  
  console.log('🔍 Starting Redis GPS monitoring...');
  
  // Poll Redis every 2 seconds for GPS data changes
  gpsMonitoringInterval = setInterval(async () => {
    if (!redis || !isRedisConnected) {
      console.log('⚠️ Redis disconnected, skipping GPS monitoring check');
      return;
    }
    
    try {
      const result = await redis.get('gps_data');
      if (result) {
        const currentGPSData = JSON.parse(result);
        
        // Check if GPS data has changed
        if (!lastGPSData || JSON.stringify(currentGPSData) !== JSON.stringify(lastGPSData)) {
          console.log('📍 GPS data changed in Redis, broadcasting to clients...');
          broadcastGPSData(currentGPSData);
          lastGPSData = currentGPSData;
        }
      }
    } catch (error) {
      console.error('❌ Error monitoring Redis GPS data:', error);
    }
  }, 2000); // Check every 2 seconds
}

function stopRedisGPSMonitoring() {
  if (gpsMonitoringInterval) {
    clearInterval(gpsMonitoringInterval);
    gpsMonitoringInterval = null;
    console.log('🛑 Stopped Redis GPS monitoring');
  }
}

// Create Redis client with better error handling
let redis;
let isRedisConnected = false;

try {
  redis = new Redis(redisConfig);
  
  // Redis event handlers
  redis.on('connect', () => {
    console.log('✅ Connected to Redis successfully!');
    isRedisConnected = true;
  });

  redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
    isRedisConnected = false;
    // Don't crash the server, just log the error
  });

  redis.on('ready', () => {
    console.log('🚀 Redis client is ready!');
    isRedisConnected = true;
    
    // Start monitoring Redis for GPS data changes
    startRedisGPSMonitoring();
  });

  redis.on('close', () => {
    console.log('🔌 Redis connection closed');
    isRedisConnected = false;
  });

  // Since lazyConnect is true, we need to manually trigger the connection
  console.log('🔗 Triggering Redis connection...');
  redis.connect().catch(err => {
    console.error('❌ Failed to connect to Redis:', err.message);
    isRedisConnected = false;
  });

} catch (error) {
  console.error('❌ Failed to create Redis client:', error.message);
  console.log('⚠️ Server will continue without Redis (health check will show redis: disconnected)');
}

// Health check endpoint
app.get('/health', async (req, res) => {
  let redisStatus = 'disconnected';
  
  if (redis && isRedisConnected) {
    try {
      await redis.ping();
      redisStatus = 'connected';
    } catch (error) {
      console.error('❌ Redis ping failed:', error.message);
      redisStatus = 'disconnected';
    }
  }
  
  // Server is healthy even if Redis is down
  res.json({ 
    status: 'healthy', 
    redis: redisStatus,
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Note: All GPS functionality now handled via WebSocket events
// REST API endpoints have been removed in favor of real-time WebSocket communication

// Serve frontend for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Send welcome message
  socket.emit('welcome', {
    message: 'Connected to AU Journey WebSocket server',
    timestamp: new Date().toISOString()
  });
  
  // Handle client disconnection
  socket.on('disconnect', (reason) => {
    console.log('🔌 Client disconnected:', socket.id, 'Reason:', reason);
  });
  
  // Handle GPS data requests
  socket.on('request-gps-data', async () => {
    if (!redis || !isRedisConnected) {
      socket.emit('gps-error', { 
        error: 'Redis not available',
        message: 'Redis connection is not established'
      });
      return;
    }
    
    try {
      const result = await redis.get('gps_data');
      if (result) {
        const gpsData = JSON.parse(result);
        socket.emit('gps-data', gpsData);
      } else {
        socket.emit('gps-error', { 
          error: 'No GPS data found',
          message: 'gps_data key not found in Redis'
        });
      }
    } catch (error) {
      console.error('❌ Error fetching GPS data for WebSocket:', error);
      socket.emit('gps-error', { 
        error: 'Failed to fetch GPS data',
        message: error.message 
      });
    }
  });
  
  // Handle GPS data updates from external sources
  socket.on('update-gps-data', async (gpsData) => {
    try {
      // Validate GPS data format
      if (!gpsData.c || !gpsData.p) {
        socket.emit('gps-error', {
          error: 'Invalid GPS data format',
          message: 'Expected format: {"c": {...}, "p": {...}, "s": "active"}'
        });
        return;
      }
      
      // Store in Redis
      await redis.set('gps_data', JSON.stringify(gpsData));
      
      // Broadcast to all WebSocket clients
      broadcastGPSData(gpsData);
      
      console.log('📍 GPS data updated via WebSocket:', gpsData);
      socket.emit('gps-update-success', { 
        success: true, 
        message: 'GPS data updated successfully',
        data: gpsData
      });
    } catch (error) {
      console.error('❌ Error updating GPS data via WebSocket:', error);
      socket.emit('gps-error', { 
        error: 'Failed to update GPS data',
        message: error.message 
      });
    }
  });

  // Handle ping for connection testing
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 AU Journey Web Server running on http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket server ready for connections`);
  console.log(`📍 GPS data: Real-time via Redis monitoring + WebSocket events`);
  console.log(`🏥 Health check: http://0.0.0.0:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down AU Journey Web Server...');
  stopRedisGPSMonitoring();
  if (redis) {
    try {
      await redis.disconnect();
    } catch (error) {
      console.log('⚠️ Error disconnecting from Redis:', error.message);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down AU Journey Web Server...');
  stopRedisGPSMonitoring();
  if (redis) {
    try {
      await redis.disconnect();
    } catch (error) {
      console.log('⚠️ Error disconnecting from Redis:', error.message);
    }
  }
  process.exit(0);
}); 