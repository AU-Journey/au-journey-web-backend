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
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  db: Number(process.env.REDIS_DB || 0),
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

// Broadcast GPS data to all connected WebSocket clients (legacy support)
function broadcastGPSData(gpsData) {
  io.emit('gps-data-update', gpsData);
  console.log('📡 Broadcasted GPS data to', io.engine.clientsCount, 'connected clients');
}

// Broadcast tram-specific data to all connected WebSocket clients
function broadcastTramData(tramId, tramData) {
  io.emit('tram-data-update', { tramId, data: tramData });
  console.log(`📡 Broadcasted ${tramId} data to`, io.engine.clientsCount, 'connected clients');
}

// Monitor Redis for multiple tram GPS data changes using polling
let lastTramData = { tram_1: null, tram_2: null };
let gpsMonitoringInterval = null;
const TRAM_IDS = ['tram_1', 'tram_2'];

function startRedisGPSMonitoring() {
  if (!redis || !isRedisConnected) {
    console.log('⚠️ Cannot start Redis GPS monitoring - Redis not connected');
    return;
  }

  console.log('🔍 Starting Redis GPS monitoring for multiple trams...');

  // Poll Redis every 2 seconds for GPS data changes
  gpsMonitoringInterval = setInterval(async () => {
    if (!redis || !isRedisConnected) {
      console.log('⚠️ Redis disconnected, skipping GPS monitoring check');
      return;
    }

    try {
      // Check each tram for updates
      for (const tramId of TRAM_IDS) {
        const result = await redis.get(tramId);
        if (result) {
          const currentTramData = JSON.parse(result);

          // Check if this tram's data has changed
          if (!lastTramData[tramId] || JSON.stringify(currentTramData) !== JSON.stringify(lastTramData[tramId])) {
            console.log(`📍 ${tramId} data changed in Redis, broadcasting to clients...`);
            broadcastTramData(tramId, currentTramData);
            lastTramData[tramId] = currentTramData;
          }
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
  
  // Handle GPS data requests (legacy support)
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

  // Handle tram-specific data requests
  socket.on('request-tram-data', async (tramId) => {
    if (!redis || !isRedisConnected) {
      socket.emit('tram-error', {
        tramId,
        error: 'Redis not available',
        message: 'Redis connection is not established'
      });
      return;
    }

    if (!TRAM_IDS.includes(tramId)) {
      socket.emit('tram-error', {
        tramId,
        error: 'Invalid tram ID',
        message: `Valid tram IDs: ${TRAM_IDS.join(', ')}`
      });
      return;
    }

    try {
      const result = await redis.get(tramId);
      if (result) {
        const tramData = JSON.parse(result);
        socket.emit('tram-data', { tramId, data: tramData });
      } else {
        socket.emit('tram-error', {
          tramId,
          error: 'No tram data found',
          message: `${tramId} key not found in Redis`
        });
      }
    } catch (error) {
      console.error(`❌ Error fetching ${tramId} data for WebSocket:`, error);
      socket.emit('tram-error', {
        tramId,
        error: 'Failed to fetch tram data',
        message: error.message
      });
    }
  });

  // Handle request for all trams data
  socket.on('request-all-trams', async () => {
    if (!redis || !isRedisConnected) {
      socket.emit('trams-error', {
        error: 'Redis not available',
        message: 'Redis connection is not established'
      });
      return;
    }

    try {
      const allTramsData = {};
      for (const tramId of TRAM_IDS) {
        const result = await redis.get(tramId);
        if (result) {
          allTramsData[tramId] = JSON.parse(result);
        }
      }

      socket.emit('all-trams-data', allTramsData);
    } catch (error) {
      console.error('❌ Error fetching all trams data for WebSocket:', error);
      socket.emit('trams-error', {
        error: 'Failed to fetch trams data',
        message: error.message
      });
    }
  });
  
  // Handle GPS data updates from external sources (legacy support)
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

  // Handle tram-specific data updates
  socket.on('update-tram-data', async ({ tramId, data }) => {
    try {
      if (!TRAM_IDS.includes(tramId)) {
        socket.emit('tram-error', {
          tramId,
          error: 'Invalid tram ID',
          message: `Valid tram IDs: ${TRAM_IDS.join(', ')}`
        });
        return;
      }

      // Validate tram data format
      if (!data.c || !data.p) {
        socket.emit('tram-error', {
          tramId,
          error: 'Invalid tram data format',
          message: 'Expected format: {"c": {...}, "p": {...}, "s": "active"}'
        });
        return;
      }

      // Store in Redis
      await redis.set(tramId, JSON.stringify(data));

      // Broadcast to all WebSocket clients
      broadcastTramData(tramId, data);

      console.log(`📍 ${tramId} data updated via WebSocket:`, data);
      socket.emit('tram-update-success', {
        tramId,
        success: true,
        message: `${tramId} data updated successfully`,
        data: data
      });
    } catch (error) {
      console.error(`❌ Error updating ${tramId} data via WebSocket:`, error);
      socket.emit('tram-error', {
        tramId,
        error: 'Failed to update tram data',
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