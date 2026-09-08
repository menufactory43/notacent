import type { APIRoute } from 'astro';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createServer } from '../../lib/mcp';
export const prerender = false;

// Point d'entrée MCP (Streamable HTTP, sans état) : un serveur et un transport par requête,
// ce qui convient à une fonction Vercel qui ne garde rien entre deux appels.
async function handle(request: Request) {
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // La réponse est déjà écrite (mode JSON) : on peut refermer sans couper le flux.
    void server.close().catch(() => {});
  }
}
export const POST: APIRoute = ({ request }) => handle(request);
// Un humain qui suit le lien du pied de page reçoit une carte de visite, pas une erreur 406.
export const GET: APIRoute = ({ request }) => {
  if (!(request.headers.get('accept') ?? '').includes('text/event-stream')) {
    return Response.json({
      name: 'Not a Cent', protocol: 'Model Context Protocol', transport: 'streamable-http', endpoint: 'https://notacent.vercel.app/api/mcp', auth: 'none',
      tools: ['search_apps', 'get_app', 'top_apps', 'how_to_submit'], readOnly: true,
      privacy: 'https://notacent.vercel.app/en/confidentialite',
      try: 'claude mcp add --transport http notacent https://notacent.vercel.app/api/mcp',
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  return handle(request);
};
export const DELETE: APIRoute = ({ request }) => handle(request);
export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version', 'Access-Control-Expose-Headers': 'Mcp-Session-Id' } });
