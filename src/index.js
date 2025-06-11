/**
 * Main Application Entry Point
 */

const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const dotenv = require('dotenv');
const logger = require('./utils/logger');
const routes = require('./routes');
const workflow = require('./core/workflow');
const memory = require('./core/memory');
const { ensureDirectoryExists } = require('./utils/helpers');
const config = require('../config/default');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/', routes);

// Socket.IO
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
  
  socket.on('join_project', (projectId) => {
    logger.info(`Client ${socket.id} joined project ${projectId}`);
    socket.join(projectId);
  });
  
  socket.on('leave_project', (projectId) => {
    logger.info(`Client ${socket.id} left project ${projectId}`);
    socket.leave(projectId);
  });
});

// Expose Socket.IO to other modules
app.set('io', io);

// Export Socket.IO instance for other modules
module.exports.getIO = () => io;

// Ensure directories exist
async function ensureDirectories() {
  try {
    // Ensure logs directory exists
    await ensureDirectoryExists(config.logging.directory);
    
    // Ensure data directory exists
    await ensureDirectoryExists(config.memory.directory);
    
    // Ensure output directory exists
    await ensureDirectoryExists(config.project.outputDir);
  } catch (error) {
    logger.error('Error creating directories:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Ensure directories exist
    await ensureDirectories();
    
    // Initialize memory
    await memory.init();
    
    // Start server
    const PORT = config.server.port;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  logger.info('Shutting down server...');
  
  // Close server
  server.close(() => {
    logger.info('Server closed');
    
    // Close any other resources
    
    process.exit(0);
  });
  
  // Force close after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Start server
startServer();