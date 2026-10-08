// Connecteur MCP « Domaines Agence Elite » servi sur /mcp (lecture seule) ou /mcp/<MCP_JETON> quand les clés sont configurées.
import worker from '../connecteurs/lws/index.js';

export const onRequest = ({ request, env }) => worker.fetch(request, env);
