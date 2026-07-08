import { runHappy } from "./run-happy.js";
import { runAdversarial } from "./run-adversarial.js";

async function main() {
  console.log("Avalify demo — two runs\n");

  const happy = await runHappy();
  console.log(`\nRun 1 settlement tx: ${happy.settlementTxHash ?? "not settled"}`);

  const adversarial = await runAdversarial();
  console.log(`\nRun 2 settlement tx: ${adversarial.settlementTxHash ?? "not settled"}`);
  console.log(`Run 2 routed away from: ${adversarial.reroutedFrom ?? "n/a"}`);

  console.log("\nTrust decay: the bad provider now carries a negative aval in avals.log.");
  console.log("Run this demo again and the ranking step will favor the good provider even more strongly.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
