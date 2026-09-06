import { readRegistryEntry } from "@/lib/sources/registry";
async function main(){
  for (const id of ["153662","153666","153820","265375","302257"]) {
    const e = await readRegistryEntry(id);
    console.log(id, "|", e?.owner, "|", e?.name, "|", (e?.description??"").slice(0,80));
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
