// Même connecteur pour /mcp/<MCP_JETON>.
import worker from '../../connecteurs/lws/index.js';

export const onRequest = ({ request, env }) => worker.fetch(request, env);
