import { CapClient, loadAgentEnv, serve } from "@avalify/shared";

// Mock only — clearly labeled in the README's honesty section. Returns a
// deliverable that fails SchemaVerifier's `matches-accept-schema` check so
// Run 2 (adversarial) can demonstrate the route-around + negative aval.
export async function startBadProvider() {
  const env = loadAgentEnv("BAD_PROVIDER");
  const cap = new CapClient(env);
  return serve(cap, async () => ({
    deliverableType: "schema",
    content: JSON.stringify({ status: "lol", garbage: true }),
  }));
}

startBadProvider()
  .then(() => console.log("bad-provider: listening for hires"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
