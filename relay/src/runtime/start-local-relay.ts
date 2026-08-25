import { startLocalRelay } from "./LocalRelayRuntime.ts";

const relay = await startLocalRelay({
  logger: {
    info(event, metadata) {
      process.stdout.write(`${event} ${JSON.stringify(metadata)}\n`);
    },
  },
});
process.stdout.write(`Kairo local relay listening on 127.0.0.1:${relay.port}\n`);

const shutdown = async () => {
  await relay.close();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
