#!/usr/bin/env node

// Simple WebSocket test script
import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

console.log('🧪 Testing WebSocket connection to:', SERVER_URL);

const socket = io(SERVER_URL);

socket.on('connect', () => {
  console.log('✅ Connected to server:', socket.id);
  
  // Test ping
  socket.emit('ping');
  
  // Request GPS data (legacy)
  setTimeout(() => {
    console.log('📍 Requesting legacy GPS data...');
    socket.emit('request-gps-data');
  }, 1000);

  // Request tram data
  setTimeout(() => {
    console.log('🚋 Requesting tram_1 data...');
    socket.emit('request-tram-data', 'tram_1');
  }, 2000);

  setTimeout(() => {
    console.log('🚋 Requesting tram_2 data...');
    socket.emit('request-tram-data', 'tram_2');
  }, 3000);

  // Request all trams data
  setTimeout(() => {
    console.log('🚋 Requesting all trams data...');
    socket.emit('request-all-trams');
  }, 4000);
  
  // Disconnect after 8 seconds to allow for all tests
  setTimeout(() => {
    console.log('👋 Disconnecting...');
    socket.disconnect();
  }, 8000);
});

socket.on('welcome', (data) => {
  console.log('👋 Welcome message:', data);
});

socket.on('pong', (data) => {
  console.log('🏓 Pong received:', data);
});

socket.on('gps-data', (data) => {
  console.log('📍 GPS data received:', data);
});

socket.on('gps-data-update', (data) => {
  console.log('📡 GPS data broadcast received:', data);
});

socket.on('gps-error', (error) => {
  console.log('❌ GPS error:', error);
});

// New tram-specific event handlers
socket.on('tram-data', (data) => {
  console.log('🚋 Tram data received:', data);
});

socket.on('tram-data-update', (data) => {
  console.log('📡 Tram data broadcast received:', data);
});

socket.on('tram-error', (error) => {
  console.log('❌ Tram error:', error);
});

socket.on('all-trams-data', (data) => {
  console.log('🚋 All trams data received:', data);
});

socket.on('trams-error', (error) => {
  console.log('❌ Trams error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
}); 