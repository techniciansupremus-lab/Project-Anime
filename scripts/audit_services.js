import fs from 'fs';
import path from 'path';

const services = ['drama', 'comics', 'movies', 'anime'];
let allOk = true;

for (const svc of services) {
  const pkgPath = path.join('services', svc, 'package.json');
  const srvPath = path.join('services', svc, 'server.js');
  const readmePath = path.join('services', svc, 'README.md');

  const pkgExists = fs.existsSync(pkgPath);
  const srvExists = fs.existsSync(srvPath);
  const readmeExists = fs.existsSync(readmePath);

  console.log(`[SERVICE: ${svc.toUpperCase()}]`);
  console.log(`  package.json: ${pkgExists ? 'OK' : 'MISSING'}`);
  console.log(`  server.js:    ${srvExists ? 'OK (' + fs.statSync(srvPath).size + ' bytes)' : 'MISSING'}`);
  console.log(`  README.md:    ${readmeExists ? 'OK (' + fs.statSync(readmePath).size + ' bytes)' : 'MISSING'}`);

  if (!pkgExists || !srvExists || !readmeExists) allOk = false;
}

console.log('\nAll files present:', allOk ? 'YES' : 'NO');
