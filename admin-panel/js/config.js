/* ============================================================
   Helpmeet Admin Panel — config.js
   ============================================================ */

window.APP_CONFIG = {
  // En produccion: https://helpmeet-licenses.fly.dev
  // En desarrollo: http://localhost:8001
  API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8001'
    : 'https://helpmeet-licenses.fly.dev',
  ADMIN_API_KEY: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'HM-2WH4-HQWS-V3A7-VXRX-LOCAL-DEV-2026'
    : 'HM-2WH4-HQWS-V3A7-VXRX-FLY-PROD-2026',
  PORT: 8095,
};
