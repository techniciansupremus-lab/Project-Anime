import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  let staticApiBase = '';
  try {
    const configPath = path.join(process.cwd(), 'public', 'eetnet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      staticApiBase = parsed.API_BASE || '';
    }
  } catch (e) {}

  const apiBase = (
    process.env.API_BASE ||
    process.env.VITE_API_BASE ||
    process.env.PUBLIC_API_BASE ||
    staticApiBase ||
    ''
  ).trim().replace(/\/+$/, '');

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ API_BASE: apiBase });
}
