import { readRegistryEntry } from "@/lib/sources/registry";
async function main() {
  for (const id of ["336161", "269703", "307488", "99999999"]) {
    const e = await readRegistryEntry(id);
    if (!e) { console.log(id, "-> not minted"); continue; }
    console.log(`${id}  owner=${e.owner}  cardSource=${e.cardSource}`);
    console.log(`      name=${e.name}  claimedCategory=${e.claimedCategory}`);
    console.log(`      services=${e.services.map(s=>s.name+":"+s.endpoint.slice(0,50)).join(" | ")}`);
    console.log(`      err=${e.cardError}`);
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
