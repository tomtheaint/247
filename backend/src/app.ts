import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { config } from "./config";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// Behind exactly one reverse proxy in production — Render's, or nginx in the
// compose setup. Without this, `req.ip` is the proxy's address for every
// request, so the rate limiter buckets the entire internet together and the
// first busy visitor exhausts the window for everyone. express-rate-limit spots
// the X-Forwarded-For header it is being asked to ignore and logs a
// ValidationError on every request, which is the noise in the deploy log.
//
// `1`, not `true`: trusting every hop lets a client forge X-Forwarded-For and
// pick its own rate-limit bucket, which is worse than not rate-limiting at all
// because it looks like it works.
if (config.nodeEnv === "production") app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

app.use(
  "/api",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, standardHeaders: true, legacyHeaders: false })
);

app.use("/api", routes);

// Serve frontend static files in production (combined image)
if (config.nodeEnv === "production") {
  const publicDir = path.join(__dirname, "../public");
  app.use(express.static(publicDir));
  // Catch-all: return index.html for client-side routing
  app.get("*", (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.use(errorHandler);

export default app;
