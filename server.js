const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to serve different content based on domain
app.use((req, res, next) => {
  const host = req.get('host');

  // Determine which site to serve based on the domain
  if (host && (host.includes('paperstreet.') || host.includes('paper-street.'))) {
    // Serve Paper Street Thrift site for subdomain
    req.siteFolder = 'paper-street';
  } else {
    // Serve main Sinclair Inlet Book Co. site for main domain
    req.siteFolder = 'sinclair-inlet';
  }

  next();
});

// Serve static files based on domain
app.use((req, res, next) => {
  if (req.siteFolder) {
    express.static(path.join(__dirname, req.siteFolder))(req, res, next);
  } else {
    next();
  }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  const siteFolder = req.siteFolder || 'sinclair-inlet';
  res.sendFile(path.join(__dirname, siteFolder, 'index.html'));
});

// Fallback for any other static assets
app.use('/sinclair-inlet', express.static(path.join(__dirname, 'sinclair-inlet')));
app.use('/paper-street', express.static(path.join(__dirname, 'paper-street')));

// Start the server
app.listen(PORT, () => {
  console.log(`Multi-site server is running on port ${PORT}`);
  console.log(`Main site: sinclair-inlet/`);
  console.log(`Paper Street site: paper-street/`);
});