// Minimal Node.js server for the Thunderbird crash game static build.
// Serves the site so it can run under Hostinger's Node.js hosting (Passenger),
// which supplies the port via process.env.PORT.
const express = require('express');
const path = require('path');

const app = express();
const ROOT = __dirname;

// Serve every static asset (html, css, js modules, svg, fonts) with the
// correct Content-Type. express.static sets text/javascript for .js, which
// is required for the site's ES modules to load.
app.use(
  express.static(ROOT, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      // Belt-and-suspenders for ES modules on hosts with odd MIME maps.
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      }
    },
  })
);

// Single-page entry: anything not matched above falls back to index.html.
app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

// Passenger sets PORT; fall back to 3000 for local runs.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Thunderbird crash game running on port ${PORT}`);
});
