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
  
  // Request GPS data
  setTimeout(() => {
    console.log('📍 Requesting GPS data...');
    socket.emit('request-gps-data');
  }, 1000);
  
  // Disconnect after 5 seconds
  setTimeout(() => {
    console.log('👋 Disconnecting...');
    socket.disconnect();
  }, 5000);
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

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
}); 