// Simple health check for Docker
import http from 'http';

const options = {
  hostname: '127.0.0.1',
  port: process.env.PORT || 8080,
  path: '/health',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end(); 