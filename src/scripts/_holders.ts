import { readBook } from "@/lib/chain/book";
import { CATEGORIES } from "@/lib/config";
async function main(){
  const b = await readBook();
  console.log("block", b.blockNumber, "active", b.active, "opened", b.opened);
  for (const r of b.rows) {
    console.log(`${r.deployment.label} #${r.id}  ${CATEGORIES[r.category]}  state=${r.state}  holder=${r.agent}  capital=${(Number(r.capitalWei)/1e18).toFixed(5)}  bond=${(Number(r.bondWei)/1e18).toFixed(5)}  epochs=${r.epochsSettled}/${r.epochsTotal}`);
  }
  const byWallet = new Map<string, Set<string>>();
  for (const r of b.rows) {
    if (/^0x0+$/i.test(r.agent)) continue;
    const k = r.agent.toLowerCase();
    if(!byWallet.has(k)) byWallet.set(k, new Set());
    byWallet.get(k)!.add(CATEGORIES[r.category]!);
  }
  console.log("\nholders:");
  for (const [w,c] of byWallet) console.log(" ", w, "→", [...c].join(", "));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
