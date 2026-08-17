import { spawn } from 'child_process';
import path from 'path';

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testEndpoint(url, options = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, options);
    const time = Date.now() - start;
    const isJson = (res.headers.get('content-type') || '').includes('json');
    let data;
    if (isJson) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { ok: res.ok, status: res.status, time, isJson, data };
  } catch (err) {
    return { ok: false, error: err.message, time: Date.now() - start };
  }
}

async function startServer(serviceName, port) {
  const srvPath = path.resolve('services', serviceName, 'server.js');
  const proc = spawn('node', [srvPath], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'pipe'
  });

  proc.stderr.on('data', d => console.error(`[${serviceName} STDERR]:`, d.toString()));

  // Wait for server to bind
  for (let i = 0; i < 20; i++) {
    await wait(250);
    const health = await testEndpoint(`http://localhost:${port}/api/health`);
    if (health.ok) {
      console.log(`✅ [${serviceName}] Server ready on port ${port}`);
      return proc;
    }
  }
  throw new Error(`Timeout waiting for ${serviceName} on port ${port}`);
}

async function runAllTests() {
  console.log('=== STARTING COMPLETE END-TO-END MICROSERVICE SUITE ===\n');

  // 1. Start all 4 servers
  const dramaProc = await startServer('drama', 8091);
  const comicsProc = await startServer('comics', 8092);
  const moviesProc = await startServer('movies', 8093);
  const animeProc = await startServer('anime', 8090);

  const results = [];

  try {
    // DRAMA TESTS
    console.log('\n--- Testing DRAMA API (Port 8091) ---');
    const dHealth = await testEndpoint('http://localhost:8091/api/health');
    console.log('  GET /api/health:', dHealth.ok ? 'PASSED' : 'FAILED', `(${dHealth.time}ms)`);
    results.push({ test: 'drama/health', ok: dHealth.ok });

    const dSearch = await testEndpoint('http://localhost:8091/api/drama/search?q=vincenzo');
    console.log('  GET /api/drama/search?q=vincenzo:', dSearch.ok ? 'PASSED' : 'FAILED', `(${dSearch.time}ms)`);
    results.push({ test: 'drama/search', ok: dSearch.ok });

    // COMICS TESTS
    console.log('\n--- Testing COMICS API (Port 8092) ---');
    const cHealth = await testEndpoint('http://localhost:8092/api/health');
    console.log('  GET /api/health:', cHealth.ok ? 'PASSED' : 'FAILED', `(${cHealth.time}ms)`);
    results.push({ test: 'comics/health', ok: cHealth.ok });

    const cSearch = await testEndpoint('http://localhost:8092/api/manga/search?q=solo');
    console.log('  GET /api/manga/search?q=solo:', cSearch.ok ? 'PASSED' : 'FAILED', `(${cSearch.time}ms)`);
    results.push({ test: 'comics/search', ok: cSearch.ok });

    // MOVIES TESTS
    console.log('\n--- Testing MOVIES API (Port 8093) ---');
    const mHealth = await testEndpoint('http://localhost:8093/api/health');
    console.log('  GET /api/health:', mHealth.ok ? 'PASSED' : 'FAILED', `(${mHealth.time}ms)`);
    results.push({ test: 'movies/health', ok: mHealth.ok });

    const mStatus = await testEndpoint('http://localhost:8093/api/movieplex/catalog/status');
    console.log('  GET /api/movieplex/catalog/status:', mStatus.ok ? 'PASSED' : 'FAILED', `(${mStatus.time}ms)`);
    results.push({ test: 'movies/status', ok: mStatus.ok });

    // ANIME TESTS
    console.log('\n--- Testing ANIME API (Port 8090) ---');
    const aHealth = await testEndpoint('http://localhost:8090/api/health');
    console.log('  GET /api/health:', aHealth.ok ? 'PASSED' : 'FAILED', `(${aHealth.time}ms)`);
    results.push({ test: 'anime/health', ok: aHealth.ok });

    const aAnilist = await testEndpoint('http://localhost:8090/api/anilist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ Page(page: 1, perPage: 1) { media { id } } }' })
    });
    console.log('  POST /api/anilist:', aAnilist.ok ? 'PASSED' : 'FAILED', `(${aAnilist.time}ms)`);
    results.push({ test: 'anime/anilist', ok: aAnilist.ok });

    const aCatalog = await testEndpoint('http://localhost:8090/api/animerulz/catalog?limit=2');
    console.log('  GET /api/animerulz/catalog:', aCatalog.ok ? 'PASSED' : 'FAILED', `(${aCatalog.time}ms)`);
    results.push({ test: 'anime/animerulz-catalog', ok: aCatalog.ok });

  } finally {
    // Tear down test server processes
    dramaProc.kill();
    comicsProc.kill();
    moviesProc.kill();
    animeProc.kill();
    console.log('\nAll test processes terminated.');
  }

  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  console.log(`\n=== TEST SUITE RESULTS: ${passed}/${total} PASSED ===`);
  if (passed !== total) process.exit(1);
}

runAllTests();
