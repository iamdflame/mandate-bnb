import { readRegistryEntry } from "@/lib/sources/registry";
const IDS=["153662","153666","153672","153674","153677","153691","153692","153696","153698","153700","153704","153705","153710","153713","153714","153725","153726","153727","153728","153730","153732","153733","153744","153745","153749","153753","153760","153763","153769","153770","153771","153774","153776","153786","153790","153795","153798","153804","153809","153811","153816","153817","153818","153820"];
async function main(){
  const owners=new Map<string,number>(); let noCard=0; let uriSample="";
  for (const id of IDS) {
    const e = await readRegistryEntry(id);
    if(!e){console.log(id,"NOT MINTED");continue;}
    owners.set(e.owner,(owners.get(e.owner)??0)+1);
    if(!e.name && !e.description){noCard++; if(!uriSample) uriSample=`${id} uri="${e.tokenURI}" err=${e.cardError} src=${e.cardSource}`;}
  }
  console.log("checked:",IDS.length);
  console.log("distinct owners:",owners.size);
  for(const [o,n] of owners) console.log("  ",o,n);
  console.log("with no name and no description:",noCard);
  console.log("sample:",uriSample);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
