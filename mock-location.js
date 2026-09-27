import { readFileSync } from 'node:fs';
import { io } from 'socket.io-client';

const routes = JSON.parse(readFileSync(new URL('./mock-routes.json', import.meta.url), 'utf8'));
const intervalMs = Math.max(250, Number(process.env.MOCK_INTERVAL_MS || 500));
const stepMeters = intervalMs * 0.005;
const backendUrl = process.env.BACKEND_URL || 'http://backend:8080';
const socket = io(backendUrl, { transports: ['websocket'] });

function distanceMeters(start, end) {
  return Math.hypot((end.lat - start.lat) * 111000, (end.lon - start.lon) * 108000);
}

function resampleRoute(waypoints) {
  const samples = [];

  for (let index = 0; index < waypoints.length; index++) {
    const start = waypoints[index];
    const end = waypoints[(index + 1) % waypoints.length];
    const steps = Math.max(1, Math.ceil(distanceMeters(start, end) / stepMeters));

    for (let step = 0; step < steps; step++) {
      const fraction = step / steps;
      samples.push({
        lat: start.lat + (end.lat - start.lat) * fraction,
        lon: start.lon + (end.lon - start.lon) * fraction
      });
    }
  }

  return samples;
}

const positions = Object.fromEntries(
  Object.entries(routes).map(([tramId, waypoints]) => [tramId, resampleRoute(waypoints)])
);
const indices = Object.fromEntries(Object.keys(positions).map((tramId) => [tramId, 0]));
let publishInterval;

function publishPositions() {
  const now = Date.now();

  for (const [tramId, route] of Object.entries(positions)) {
    const index = indices[tramId];
    const current = route[index];
    const previous = route[(index - 1 + route.length) % route.length];

    socket.emit('update-tram-data', {
      tramId,
      data: {
        c: { ...current, t: new Date(now).toISOString() },
        p: { ...previous, t: new Date(now - intervalMs).toISOString() },
        s: 'active'
      }
    });

    indices[tramId] = (index + 1) % route.length;
  }
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
