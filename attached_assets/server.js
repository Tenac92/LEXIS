const app = require('./app');
const { createServer } = require('http');

const PORT = process.env.PORT || 3001;
let server = null;

const cleanup = () => {
  if (server) {
    server.close(() => {
      console.log('Server shutdown complete');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

// Set up process handlers
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  cleanup();
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  cleanup();
});

// Instance management
const instances = new Set();
if (instances.has(process.pid)) {
  console.log('Instance already running');
  process.exit(1);
}
instances.add(process.pid);

// Create and start server
server = createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

module.exports = server;