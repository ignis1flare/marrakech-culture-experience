import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { isAllowedMarrakechOrigin } from "./lib/marrakech-cors";

const app: Express = express();
const sessionSecret =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV !== "production"
    ? "marrakech-dev-insecure-session-secret-min32"
    : undefined);
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required for secure Marrakech sessions");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedMarrakechOrigin(origin) ? origin : false);
    },
    credentials: true,
  }),
);
app.use(cookieParser(sessionSecret));
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
