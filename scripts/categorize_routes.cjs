const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');

const routeMap = { anime: [], drama: [], comics: [], movies: [], shared: [] };

lines.forEach((line, i) => {
  const match = line.match(/app\.(get|post|put|delete)\s*\(['"](\/api\/[^'"]+)/);
  if (!match) return;
  const route = match[2];
  let category = 'shared';
  if (route.includes('/drama')) category = 'drama';
  else if (route.includes('/manga') || route.includes('/webtoon') || route.includes('/manhwa')) category = 'comics';
  else if (route.includes('/movieplex') || route.includes('/movies') || route.includes('/netmirror')) category = 'movies';
  else if (route.includes('/m3u8-proxy') || route.includes('/ts-proxy') || route.includes('/img-proxy') || route.includes('/health') || route.includes('/subtitle-proxy')) category = 'shared';
  else category = 'anime';
  routeMap[category].push({ route, line: i + 1 });
});

Object.entries(routeMap).forEach(([cat, routes]) => {
  console.log('\n[' + cat.toUpperCase() + ']');
  routes.forEach(r => console.log('  L' + r.line + ': ' + r.route));
});
