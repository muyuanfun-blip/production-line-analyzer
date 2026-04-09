import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Debug endpoint
app.get("/api/debug", async (req, res) => {
  const { getDb } = await import("../server/db");
  const db = await getDb();
  if (!db) {
    res.json({ status: "no db", env: !!process.env.DATABASE_URL });
    return;
  }
  try {
    const { sql } = await import('drizzle-orm');
    const { productionLines } = await import('../drizzle/schema');
    const result = await db.select().from(productionLines).limit(1);
    res.json({ status: "ok", rows: result.length });
  } catch (e: any) {
    res.json({ status: "error", message: e.message, code: e.code, cause: e.cause?.message });
  }
});

registerOAuthRoutes(app);

app.use("/api/trpc", createExpressMiddleware({
  router: appRouter,
  createContext,
}));

// Serve static files from dist/public
const DIST_PATH = path.resolve(__dirname, "..", "public");
app.use(express.static(DIST_PATH));

// SPA fallback
app.use("*", (_req, res) => {
  const indexPath = path.resolve(DIST_PATH, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Not found");
  }
});

export default app;
