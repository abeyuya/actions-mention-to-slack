import { warning } from "@actions/core";
import { main } from "./main.js";

main().catch((error: unknown) => {
  const e = error instanceof Error ? error : undefined;
  warning(`Unhandled error in main(): ${e?.stack ?? String(error)}`);
});
