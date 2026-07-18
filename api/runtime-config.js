export default function handler(req, res) {
  const apiBase = (
    process.env.API_BASE ||
    process.env.VITE_API_BASE ||
    process.env.PUBLIC_API_BASE ||
    ''
  ).trim().replace(/\/+$/, '');

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ API_BASE: apiBase });
}
