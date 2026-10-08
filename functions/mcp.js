// Connecteur MCP « Domaines LWS » (lecture seule) servi sur /mcp par Cloudflare Pages.
import worker from '../connecteurs/lws/index.js';

export const onRequest = ({ request }) => worker.fetch(request);
