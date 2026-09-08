import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const url = process.argv[2] ?? 'http://localhost:4321/api/mcp';
const c = new Client({ name: 'test', version: '0' });
await c.connect(new StreamableHTTPClientTransport(new URL(url)));
const tools = await c.listTools();
console.log('tools:', tools.tools.map((t) => `${t.name} [${Object.entries(t.annotations ?? {}).filter(([, v]) => v).map(([k]) => k).join(',')}]`).join(' | '));
for (const [name, args] of [['top_apps', { limit: 3 }], ['search_apps', { query: 'swift' }], ['get_app', { slug: 'correspondance' }], ['get_app', { slug: 'nope' }], ['how_to_submit', { language: 'fr' }]]) {
  const r = await c.callTool({ name, arguments: args });
  console.log(`\n== ${name}(${JSON.stringify(args)}) isError=${r.isError ?? false}\n` + r.content[0].text.slice(0, 500));
}
await c.close();
