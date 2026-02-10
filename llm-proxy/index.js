const express = require('express');
const fs = require('fs');
const path = require('path');
const ProxyServer = require('./src/proxy');

// Load provider configuration
const providersPath = path.join(__dirname, 'providers.json');
const providers = JSON.parse(fs.readFileSync(providersPath, 'utf8'));

// Create Express app
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Initialize proxy server
const proxy = new ProxyServer(app, providers);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy Server running on port ${PORT}`);
  console.log(`Available providers: ${Object.keys(providers).join(', ')}`);
  console.log(`Example usage: http://localhost:${PORT}/proxy/anthropic/v1/messages`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
