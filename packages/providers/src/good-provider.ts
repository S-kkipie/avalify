import { CapClient, loadAgentEnv, serve } from "@avalify/shared";

export async function startGoodProvider() {
  const env = loadAgentEnv("GOOD_PROVIDER");
  const cap = new CapClient(env);
  return serve(cap, async () => ({
    deliverableType: "schema",
    content: JSON.stringify({ status: "ok", summary: "dataset processed successfully", rowCount: 128 }),
  }));
}

startGoodProvider()
  .then(() => console.log("good-provider: listening for hires"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
