// Vercel Serverless Function
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import path from "path";
import fs from "fs";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerOAuthRoutes(app);

app.use("/api/trpc", createExpressMiddleware({
  router: appRouter,
  createContext,
}));

// Serve static files from dist/public
const DIST_PATH = path.resolve(__dirname, "..", "dist", "public");
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
