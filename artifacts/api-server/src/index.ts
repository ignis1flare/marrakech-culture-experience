import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { seedMarrakechContent } from "./lib/marrakech-seed";
import { attachMarrakechRealtime } from "./lib/marrakech-realtime";

const rawPort = process.env["PORT"] ?? "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
attachMarrakechRealtime(server);

void seedMarrakechContent()
  .then(() => {
    server.listen(port, () => logger.info({ port }, "Server listening"));
  })
  .catch((err: unknown) => {
    logger.error({ err }, "Unable to seed Marrakech content");
    process.exit(1);
  });
