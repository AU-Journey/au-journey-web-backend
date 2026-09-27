import { readFileSync } from 'node:fs';
import { io } from 'socket.io-client';

const route = JSON.parse(readFileSync(new URL('./mock-route.json', import.meta.url), 'utf8'));
const intervalMs = Math.max(500, Number(process.env.MOCK_INTERVAL_MS || 2000));
const backendUrl = process.env.BACKEND_URL || 'http://backend:8080';
const socket = io(backendUrl, { transports: ['websocket'] });

let routeIndex = 0;
let publishInterval;

function publishPositions() {
  const timestamp = new Date().toISOString();

  for (const [tramId, offset] of [['tram_1', 0], ['tram_2', Math.floor(route.length / 2)]]) {
    const currentIndex = (routeIndex + offset) % route.length;
    const previousIndex = (currentIndex - 1 + route.length) % route.length;
    const current = route[currentIndex];
    const previous = route[previousIndex];

    socket.emit('update-tram-data', {
      tramId,
      data: {
        c: { ...current, t: timestamp },
        p: { ...previous, t: timestamp },
        s: 'active'
      }
    });
  }

  routeIndex = (routeIndex + 1) % route.length;
}

socket.on('connect', () => {
  console.log(`Mock location publisher connected to ${backendUrl}`);
  clearInterval(publishInterval);
  publishPositions();
  publishInterval = setInterval(publishPositions, intervalMs);
});

socket.on('disconnect', () => {
  clearInterval(publishInterval);
});

socket.on('connect_error', (error) => {
  console.error(`Mock location publisher connection failed: ${error.message}`);
});

socket.on('tram-error', (error) => {
  console.error('Mock location update rejected:', error);
});
