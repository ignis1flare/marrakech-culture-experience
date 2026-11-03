import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { seedMarrakechContent } from "./lib/marrakech-seed";
import { attachMarrakechRealtime } from "./lib/marrakech-realtime";

let seedPromise: Promise<void> | undefined;

function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seedMarrakechContent().catch((error: unknown) => {
      seedPromise = undefined;
      throw error;
    });
  }

  return seedPromise;
}

const server = createServer(async (req, res) => {
  try {
    await ensureSeeded();
    app(req, res);
  } catch (error) {
    logger.error({ err: error }, "Unable to seed Marrakech content");
    res.statusCode = 500;
    res.end("Server initialization failed");
  }
});

attachMarrakechRealtime(server);

export default server;