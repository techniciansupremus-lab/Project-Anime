/**
 * Monolith Compiler Script: compile_monolith.js
 *
 * Compiles modular service files from services/ into a unified, high-performance monolith server
 * located at "the compilation/server.js".
 *
 * Usage:
 *   node scripts/compile_monolith.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const servicesDir = path.join(rootDir, 'services');
const outputDir = path.join(rootDir, 'the compilation');
const outputFile = path.join(outputDir, 'server.js');

console.log('🔨 Starting Monolith Compilation...');

// 1. Ensure "the compilation" directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 2. Read each service file
const serviceNames = ['anime', 'drama', 'comics', 'movies'];
const serviceSources = {};

for (const name of serviceNames) {
  const servicePath = path.join(servicesDir, name, 'server.js');
  if (!fs.existsSync(servicePath)) {
    console.error(`❌ Error: Missing service file at ${servicePath}`);
    process.exit(1);
  }
  serviceSources[name] = fs.readFileSync(servicePath, 'utf8');
  console.log(`  ✓ Read services/${name}/server.js (${serviceSources[name].length} bytes)`);
}

// 3. Extract unique imports from all services
const allImports = new Set([
  "import express from 'express';",
  "import cors from 'cors';",
  "import axios from 'axios';",
  "import * as cheerio from 'cheerio';",
  "import https from 'https';",
  "import crypto from 'crypto';",
  "import vm from 'node:vm';",
  "import { ANIME, META } from '@consumet/extensions';"
]);

// 4. Helper to clean and extract service body (strip individual imports, app init, app.listen)
function extractServiceBody(source, serviceName) {
  let lines = source.split('\n');

  // Filter out import lines, app creation, PORT definition, app.listen blocks
  let inListenBlock = false;
  const filtered = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip import statements
    if (trimmed.startsWith('import ')) continue;

    // Skip individual app initialization & standalone listens
    if (trimmed.startsWith('const app = express()')) continue;
    if (trimmed.startsWith('app.set(')) continue;
    if (trimmed.startsWith('const PORT =')) continue;
    if (trimmed.startsWith('const startedAt =')) continue;
    if (trimmed.startsWith('app.use(cors(')) continue;
    if (trimmed.startsWith('app.use(express.json(')) continue;
    if (trimmed.startsWith("process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'")) continue;
    if (trimmed.startsWith('const httpsAgent = new https.Agent')) continue;

    // Check for app.listen block
    if (trimmed.startsWith('app.listen(')) {
      inListenBlock = true;
      continue;
    }
    if (inListenBlock) {
      if (trimmed === '});' || trimmed === '})') {
        inListenBlock = false;
      }
      continue;
    }

    filtered.push(line);
  }

  return `\n// ============================================================================\n` +
         `// 📦 MODULE: ${serviceName.toUpperCase()} SERVICE\n` +
         `// ============================================================================\n` +
         filtered.join('\n');
}

// 5. Compose the unified compilation server
const header = `/**
 * ============================================================================
 * ⚠️ AUTO-GENERATED MONOLITH SERVER — DO NOT EDIT DIRECTLY!
 * ============================================================================
 *
 * Source of Truth:
 *   - services/anime/server.js
 *   - services/drama/server.js
 *   - services/comics/server.js
 *   - services/movies/server.js
 *
 * Recompile with:
 *   npm run build:server   (or: node scripts/compile_monolith.js)
 *
 * Run with:
 *   npm start              (or: node "the compilation/server.js")
 * ============================================================================
 */

${Array.from(allImports).join('\n')}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 8080;
const startedAt = new Date();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

// URL Normalizer: Ensures /anime/..., /drama/..., /manga/..., /movies/... map to /api/...
app.use((req, res, next) => {
  if (req.url && !req.url.startsWith('/api/') && req.url !== '/api') {
    req.url = '/api' + req.url;
  }
  next();
});

// Global Shared Helpers
function publicHost(req) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .toString().split(',')[0].trim();
  return \`\${proto}://\${req.get('host')}\`;
}

function safeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value || '';
  }
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function streamProxyHeaders(targetUrl, referer, extraHeaders = {}) {
  return {
    'User-Agent': BROWSER_UA,
    'Accept': '*/*',
    ...extraHeaders,
    'Referer': referer,
    'Origin': safeOrigin(referer),
  };
}
`;

// Deduplicate helper functions that might be defined in multiple services
let animeCode = extractServiceBody(serviceSources.anime, 'anime');
let dramaCode = extractServiceBody(serviceSources.drama, 'drama');
let comicsCode = extractServiceBody(serviceSources.comics, 'comics');
let moviesCode = extractServiceBody(serviceSources.movies, 'movies');

// Clean duplicate helper function definitions from child services
const helpersToRemove = [
  /function publicHost\(req\)\s*\{[\s\S]*?return `\$\{proto\}:\/\/\$\{req\.get\('host'\)\}`;?\s*\}/g,
  /function safeOrigin\(value\)\s*\{[\s\S]*?return value \|\| '';?\s*\}/g,
  /function streamProxyHeaders\(targetUrl, referer, extraHeaders = \{\}\)\s*\{[\s\S]*?return \{[\s\S]*?\};?\s*\}/g,
  /const BROWSER_UA\s*=\s*'[^']+';/g,
  /app\.use\(\(req, res, next\) =>\s*\{[\s\S]*?if \(req\.url && !req\.url\.startsWith\('\/api\/'\)\s*&& req\.url !== '\/api'\)\s*\{[\s\S]*?req\.url = '\/api' \+ req\.url;[\s\S]*?\}\s*next\(\);?\s*\}\);/g
];

for (const pattern of helpersToRemove) {
  animeCode = animeCode.replace(pattern, '');
  dramaCode = dramaCode.replace(pattern, '');
  comicsCode = comicsCode.replace(pattern, '');
  moviesCode = moviesCode.replace(pattern, '');
}

// Global Health & Status endpoint
const footer = `
// ============================================================================
// 🏥 UNIFIED HEALTH & STATUS ENDPOINT
// ============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    startedAt: startedAt.toISOString(),
    services: ['anime', 'drama', 'comics', 'movies'],
    monolith: 'the compilation/server.js'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '2.0.0',
    mode: 'monolith-compilation',
    endpoints: {
      anime: ['/api/info/:anilistId', '/api/gogoanime/watch', '/api/hianime/watch', '/api/animerulz/watch'],
      drama: ['/api/drama/home', '/api/drama/list', '/api/drama/info/:dramaId', '/api/drama/stream/:episodeId'],
      comics: ['/api/manga/home', '/api/manga/search', '/api/manga/info/:id', '/api/manga/read/:chapterId'],
      movies: ['/api/movies/home', '/api/movieplex/catalog', '/api/movieplex/stream', '/api/netmirror/search']
    }
  });
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// Start Monolith Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`\n====================================================================\`);
  console.log(\`🚀 EetNet Monolith Backend Running on http://localhost:\${PORT}\`);
  console.log(\`📦 Compiled from: services/anime, drama, comics, movies\`);
  console.log(\`🕒 Started at: \${startedAt.toLocaleTimeString()}\`);
  console.log(\`====================================================================\\n\`);
});
`;

const compiledCode = header + animeCode + dramaCode + comicsCode + moviesCode + footer;

fs.writeFileSync(outputFile, compiledCode, 'utf8');
console.log(`\n🎉 Compilation Successful!`);
console.log(`📁 Generated: ${outputFile} (${compiledCode.length} bytes)`);
