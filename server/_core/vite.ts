import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// setupVite is only used in development
export async function setupVite(app: Express, server: any) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "true") {
    throw new Error("setupVite should not be called in production");
  }
  
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      middlewareMode: true,
      allowedHosts: true,
    },
    appType: "custom",
  });
  
  app.use(vite.middlewares);
  
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      let template = fs.readFileSync(
        path.resolve(import.meta.dirname, "../client/index.html"),
        "utf-8"
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      next(e);
    }
  });
}

// serveStatic for production - serves from dist/public
export function serveStatic(app: Express) {
  // When bundled, __dirname = dist/_core, so we go up 2 levels
  const DIST_PATH = path.resolve(__dirname, "..", "..", "dist", "public");
  
  console.log(`[serveStatic] __dirname: ${__dirname}`);
  console.log(`[serveStatic] DIST_PATH: ${DIST_PATH}`);
  console.log(`[serveStatic] Exists: ${fs.existsSync(DIST_PATH)}`);
  
  if (!fs.existsSync(DIST_PATH)) {
    console.error(`[serveStatic] ERROR: ${DIST_PATH} not found`);
    console.error(`[serveStatic] __dirname contents:`, fs.readdirSync(path.resolve(__dirname, "..")));
    console.error(`[serveStatic] Parent contents:`, fs.readdirSync(path.resolve(__dirname, "..", "..")));
  }

  app.use(express.static(DIST_PATH));

  app.use("*", (_req, res) => {
    const indexPath = path.resolve(DIST_PATH, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("index.html not found");
    }
  });
}
