/** Does MandateX's unsubstituted-template finding reproduce on live BSC data? */
import { listAgents, getAgent } from "@/lib/sources/scan";
const page = await listAgents({ chainId: 56, limit: 100, offset: 0, sortBy: "token_id", sortOrder: "asc" });
const items = page.items ?? [];
console.log(`checking ${items.length} agents for template endpoints…`);
let templated = 0, checked = 0, noEndpoint = 0;
const RE = /\{agent[_-]?id\}|\{tokenId\}|%7BagentId%7D/i;
for (const a of items.slice(0, 40)) {
  try {
    const d = await getAgent(56, String(a.token_id));
    checked++;
    const eps = [d.agent_url, d.a2a_endpoint, d.mcp_server, d.endpoint_verified_domain].filter(Boolean) as string[];
    if (eps.length === 0) { noEndpoint++; continue; }
    for (const e of eps) if (RE.test(e)) { templated++; console.log(`  TEMPLATE  ${a.token_id}  ${e.slice(0, 78)}`); break; }
  } catch { /* the API 500s under load; a refusal is not a finding */ }
}
console.log(`\nchecked ${checked} · ${noEndpoint} with no endpoint at all · ${templated} unsubstituted templates`);
