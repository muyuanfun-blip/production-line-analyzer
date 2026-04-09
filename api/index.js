// api/index.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq, asc, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// drizzle/schema.ts
import {
  serial,
  pgTable,
  text,
  timestamp,
  varchar,
  numeric,
  json,
  integer
} from "drizzle-orm/pg-core";
var users = pgTable("pla_users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var productionLines = pgTable("pla_production_lines", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetCycleTime: numeric("targetCycleTime", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var workstations = pgTable("pla_workstations", {
  id: serial("id").primaryKey(),
  productionLineId: integer("productionLineId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sequenceOrder: integer("sequenceOrder").notNull().default(0),
  cycleTime: numeric("cycleTime", { precision: 10, scale: 2 }).notNull(),
  manpower: integer("manpower").notNull().default(1),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var actionSteps = pgTable("pla_action_steps", {
  id: serial("id").primaryKey(),
  workstationId: integer("workstationId").notNull(),
  stepName: varchar("stepName", { length: 255 }).notNull(),
  stepOrder: integer("stepOrder").notNull().default(0),
  duration: numeric("duration", { precision: 10, scale: 2 }).notNull(),
  actionType: varchar("actionType", { length: 30 }).default("value_added").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var analysisSnapshots = pgTable("pla_analysis_snapshots", {
  id: serial("id").primaryKey(),
  productionLineId: integer("productionLineId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  note: text("note"),
  balanceRate: numeric("balanceRate", { precision: 6, scale: 2 }).notNull(),
  balanceLoss: numeric("balanceLoss", { precision: 6, scale: 2 }).notNull(),
  totalTime: numeric("totalTime", { precision: 10, scale: 2 }).notNull(),
  maxTime: numeric("maxTime", { precision: 10, scale: 2 }).notNull(),
  minTime: numeric("minTime", { precision: 10, scale: 2 }).notNull(),
  avgTime: numeric("avgTime", { precision: 10, scale: 2 }).notNull(),
  workstationCount: integer("workstationCount").notNull(),
  totalManpower: integer("totalManpower").notNull(),
  taktTime: numeric("taktTime", { precision: 10, scale: 2 }),
  taktPassRate: numeric("taktPassRate", { precision: 6, scale: 2 }),
  taktPassCount: integer("taktPassCount"),
  upph: numeric("upph", { precision: 10, scale: 4 }),
  workstationsData: json("workstationsData").notNull(),
  bottleneckName: varchar("bottleneckName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  ollamaApiKey: process.env.OLLAMA_API_KEY ?? "",
  ollamaBaseUrl: "https://ollama.com",
  ollamaModel: "qwen3-coder:480b"
};

// server/db.ts
var _db = null;
var _sql = null;
async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _sql = postgres(ENV.databaseUrl);
      _db = drizzle(_sql);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    await db.insert(users).values(user).onConflictDoUpdate({
      target: users.openId,
      set: {
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        lastSignedIn: user.lastSignedIn ?? /* @__PURE__ */ new Date()
      }
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getAllProductionLines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productionLines).orderBy(desc(productionLines.createdAt));
}
async function getProductionLineById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(productionLines).where(eq(productionLines.id, id)).limit(1);
  return result[0];
}
async function createProductionLine(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productionLines).values(data).returning();
  return result;
}
async function updateProductionLine(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(productionLines).set(data).where(eq(productionLines.id, id));
}
async function deleteProductionLine(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ws = await db.select().from(workstations).where(eq(workstations.productionLineId, id));
  for (const w of ws) {
    await db.delete(actionSteps).where(eq(actionSteps.workstationId, w.id));
  }
  await db.delete(workstations).where(eq(workstations.productionLineId, id));
  return db.delete(productionLines).where(eq(productionLines.id, id));
}
async function getWorkstationsByLine(productionLineId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workstations).where(eq(workstations.productionLineId, productionLineId)).orderBy(asc(workstations.sequenceOrder));
}
async function getWorkstationById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(workstations).where(eq(workstations.id, id)).limit(1);
  return result[0];
}
async function createWorkstation(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(workstations).values(data).returning();
}
async function updateWorkstation(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(workstations).set(data).where(eq(workstations.id, id));
}
async function deleteWorkstation(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(actionSteps).where(eq(actionSteps.workstationId, id));
  return db.delete(workstations).where(eq(workstations.id, id));
}
async function bulkCreateWorkstations(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  return db.insert(workstations).values(data);
}
async function getActionStepsByWorkstation(workstationId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actionSteps).where(eq(actionSteps.workstationId, workstationId)).orderBy(asc(actionSteps.stepOrder));
}
async function createActionStep(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(actionSteps).values(data).returning();
}
async function updateActionStep(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(actionSteps).set(data).where(eq(actionSteps.id, id));
}
async function deleteActionStep(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(actionSteps).where(eq(actionSteps.id, id));
}
async function bulkCreateActionSteps(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  return db.insert(actionSteps).values(data);
}
async function getSnapshotsByLine(productionLineId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(analysisSnapshots).where(eq(analysisSnapshots.productionLineId, productionLineId)).orderBy(desc(analysisSnapshots.createdAt));
}
async function getSnapshotById(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(analysisSnapshots).where(eq(analysisSnapshots.id, id)).limit(1);
  return rows[0] ?? null;
}
async function createSnapshot(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(analysisSnapshots).values(data).returning();
}
async function deleteSnapshot(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(analysisSnapshots).where(eq(analysisSnapshots.id, id));
}
async function getAllLinesSnapshotHistory() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const lines = await db.select().from(productionLines).orderBy(asc(productionLines.id));
  if (lines.length === 0) return [];
  const results = await Promise.all(
    lines.map(async (line) => {
      const snapshots = await db.select().from(analysisSnapshots).where(eq(analysisSnapshots.productionLineId, line.id)).orderBy(asc(analysisSnapshots.createdAt));
      return {
        lineId: line.id,
        lineName: line.name,
        lineStatus: line.status,
        snapshots: snapshots.map((s) => ({
          id: s.id,
          name: s.name,
          balanceRate: Number(s.balanceRate),
          taktPassRate: s.taktPassRate ? Number(s.taktPassRate) : null,
          upph: s.upph ? Number(s.upph) : null,
          maxTime: Number(s.maxTime),
          avgTime: Number(s.avgTime),
          workstationCount: s.workstationCount,
          createdAt: s.createdAt
        }))
      };
    })
  );
  return results.filter((r) => r.snapshots.length > 0);
}
async function getAllLinesLatestSnapshot() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const lines = await db.select().from(productionLines).orderBy(asc(productionLines.id));
  if (lines.length === 0) return [];
  const results = await Promise.all(
    lines.map(async (line) => {
      const snapshots = await db.select().from(analysisSnapshots).where(eq(analysisSnapshots.productionLineId, line.id)).orderBy(desc(analysisSnapshots.createdAt)).limit(1);
      const latest = snapshots[0] ?? null;
      return {
        lineId: line.id,
        lineName: line.name,
        lineStatus: line.status,
        targetCycleTime: line.targetCycleTime ? Number(line.targetCycleTime) : null,
        snapshot: latest ? {
          id: latest.id,
          name: latest.name,
          balanceRate: Number(latest.balanceRate),
          balanceLoss: Number(latest.balanceLoss),
          maxTime: Number(latest.maxTime),
          avgTime: Number(latest.avgTime),
          workstationCount: latest.workstationCount,
          totalManpower: latest.totalManpower,
          taktPassRate: latest.taktPassRate ? Number(latest.taktPassRate) : null,
          upph: latest.upph ? Number(latest.upph) : null,
          bottleneckName: latest.bottleneckName,
          createdAt: latest.createdAt
        } : null
      };
    })
  );
  return results;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z2 } from "zod";
var productionLineInput = z2.object({
  name: z2.string().min(1),
  description: z2.string().optional(),
  targetCycleTime: z2.number().positive().optional(),
  status: z2.enum(["active", "inactive", "archived"]).optional()
});
var workstationInput = z2.object({
  productionLineId: z2.number().int().positive(),
  name: z2.string().min(1),
  sequenceOrder: z2.number().int().min(0).optional(),
  cycleTime: z2.number().positive(),
  manpower: z2.number().int().positive().optional(),
  description: z2.string().optional(),
  notes: z2.string().optional()
});
var actionStepInput = z2.object({
  workstationId: z2.number().int().positive(),
  stepName: z2.string().min(1),
  stepOrder: z2.number().int().min(0).optional(),
  duration: z2.number().positive(),
  actionType: z2.enum(["value_added", "non_value_added", "necessary_waste"]).optional(),
  description: z2.string().optional()
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  // ─── Production Lines ───────────────────────────────────────────────────
  productionLine: router({
    list: publicProcedure.query(async () => {
      return getAllProductionLines();
    }),
    getById: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ input }) => {
      return getProductionLineById(input.id);
    }),
    create: publicProcedure.input(productionLineInput).mutation(async ({ input }) => {
      const result = await createProductionLine({
        name: input.name,
        description: input.description ?? null,
        targetCycleTime: input.targetCycleTime?.toString() ?? null,
        status: input.status ?? "active"
      });
      return { success: true, insertId: result.insertId };
    }),
    update: publicProcedure.input(z2.object({ id: z2.number().int().positive() }).merge(productionLineInput.partial())).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData = {};
      if (data.name !== void 0) updateData.name = data.name;
      if (data.description !== void 0) updateData.description = data.description;
      if (data.targetCycleTime !== void 0) updateData.targetCycleTime = data.targetCycleTime.toString();
      if (data.status !== void 0) updateData.status = data.status;
      await updateProductionLine(id, updateData);
      return { success: true };
    }),
    delete: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
      await deleteProductionLine(input.id);
      return { success: true };
    })
  }),
  // ─── Workstations ────────────────────────────────────────────────────────
  workstation: router({
    listByLine: publicProcedure.input(z2.object({ productionLineId: z2.number().int().positive() })).query(async ({ input }) => {
      return getWorkstationsByLine(input.productionLineId);
    }),
    getById: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ input }) => {
      return getWorkstationById(input.id);
    }),
    create: publicProcedure.input(workstationInput).mutation(async ({ input }) => {
      const result = await createWorkstation({
        productionLineId: input.productionLineId,
        name: input.name,
        sequenceOrder: input.sequenceOrder ?? 0,
        cycleTime: input.cycleTime.toString(),
        manpower: input.manpower ?? 1,
        description: input.description ?? null,
        notes: input.notes ?? null
      });
      return { success: true, insertId: result.insertId };
    }),
    update: publicProcedure.input(z2.object({ id: z2.number().int().positive() }).merge(workstationInput.omit({ productionLineId: true }).partial())).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData = {};
      if (data.name !== void 0) updateData.name = data.name;
      if (data.sequenceOrder !== void 0) updateData.sequenceOrder = data.sequenceOrder;
      if (data.cycleTime !== void 0) updateData.cycleTime = data.cycleTime.toString();
      if (data.manpower !== void 0) updateData.manpower = data.manpower;
      if (data.description !== void 0) updateData.description = data.description;
      if (data.notes !== void 0) updateData.notes = data.notes;
      await updateWorkstation(id, updateData);
      return { success: true };
    }),
    delete: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
      await deleteWorkstation(input.id);
      return { success: true };
    }),
    bulkImport: publicProcedure.input(z2.object({
      productionLineId: z2.number().int().positive(),
      workstations: z2.array(z2.object({
        name: z2.string().min(1),
        sequenceOrder: z2.number().int().min(0),
        cycleTime: z2.number().positive(),
        manpower: z2.number().int().positive().optional(),
        description: z2.string().optional()
      }))
    })).mutation(async ({ input }) => {
      const data = input.workstations.map((w) => ({
        productionLineId: input.productionLineId,
        name: w.name,
        sequenceOrder: w.sequenceOrder,
        cycleTime: w.cycleTime.toString(),
        manpower: w.manpower ?? 1,
        description: w.description ?? null,
        notes: null
      }));
      await bulkCreateWorkstations(data);
      return { success: true, count: data.length };
    })
  }),
  // ─── Action Steps ────────────────────────────────────────────────────────
  actionStep: router({
    listByWorkstation: publicProcedure.input(z2.object({ workstationId: z2.number().int().positive() })).query(async ({ input }) => {
      return getActionStepsByWorkstation(input.workstationId);
    }),
    create: publicProcedure.input(actionStepInput).mutation(async ({ input }) => {
      const result = await createActionStep({
        workstationId: input.workstationId,
        stepName: input.stepName,
        stepOrder: input.stepOrder ?? 0,
        duration: input.duration.toString(),
        actionType: input.actionType ?? "value_added",
        description: input.description ?? null
      });
      return { success: true, insertId: result.insertId };
    }),
    update: publicProcedure.input(z2.object({ id: z2.number().int().positive() }).merge(actionStepInput.omit({ workstationId: true }).partial())).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData = {};
      if (data.stepName !== void 0) updateData.stepName = data.stepName;
      if (data.stepOrder !== void 0) updateData.stepOrder = data.stepOrder;
      if (data.duration !== void 0) updateData.duration = data.duration.toString();
      if (data.actionType !== void 0) updateData.actionType = data.actionType;
      if (data.description !== void 0) updateData.description = data.description;
      await updateActionStep(id, updateData);
      return { success: true };
    }),
    delete: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
      await deleteActionStep(input.id);
      return { success: true };
    }),
    bulkCreate: publicProcedure.input(z2.object({
      workstationId: z2.number().int().positive(),
      steps: z2.array(z2.object({
        stepName: z2.string().min(1),
        stepOrder: z2.number().int().min(0),
        duration: z2.number().positive(),
        actionType: z2.enum(["value_added", "non_value_added", "necessary_waste"]).optional(),
        description: z2.string().optional()
      }))
    })).mutation(async ({ input }) => {
      const data = input.steps.map((s) => ({
        workstationId: input.workstationId,
        stepName: s.stepName,
        stepOrder: s.stepOrder,
        duration: s.duration.toString(),
        actionType: s.actionType ?? "value_added",
        description: s.description ?? null
      }));
      await bulkCreateActionSteps(data);
      return { success: true, count: data.length };
    })
  }),
  // ─── AI Analysis ─────────────────────────────────────────────────────────
  analysis: router({
    aiSuggest: publicProcedure.input(z2.object({
      productionLineId: z2.number().int().positive(),
      productionLineName: z2.string(),
      targetCycleTime: z2.number().optional(),
      workstations: z2.array(z2.object({
        name: z2.string(),
        cycleTime: z2.number(),
        manpower: z2.number(),
        sequenceOrder: z2.number()
      }))
    })).mutation(async ({ input }) => {
      const bottleneck = input.workstations.reduce((max, w) => w.cycleTime > max.cycleTime ? w : max, input.workstations[0]);
      const totalTime = input.workstations.reduce((sum, w) => sum + w.cycleTime, 0);
      const avgTime = totalTime / input.workstations.length;
      const maxTime = Math.max(...input.workstations.map((w) => w.cycleTime));
      const balanceRate = input.workstations.length > 0 ? (totalTime / (maxTime * input.workstations.length) * 100).toFixed(1) : "0";
      const taktTimeInfo = input.targetCycleTime ? `
**\u76EE\u6A19\u7BC0\u62CD\u6642\u9593\uFF08Takt Time\uFF09\uFF1A** ${input.targetCycleTime}s\uFF08\u6BCF\u5C0F\u6642\u76EE\u6A19\u7522\u80FD\uFF1A${Math.floor(3600 / input.targetCycleTime)} \u4EF6\uFF09` : "\n**\u76EE\u6A19\u7BC0\u62CD\u6642\u9593\uFF1A** \u672A\u8A2D\u5B9A";
      const exceedStations = input.targetCycleTime ? input.workstations.filter((w) => w.cycleTime > input.targetCycleTime) : [];
      const passStations = input.targetCycleTime ? input.workstations.filter((w) => w.cycleTime <= input.targetCycleTime) : [];
      const taktPassRate = input.targetCycleTime && input.workstations.length > 0 ? (passStations.length / input.workstations.length * 100).toFixed(1) : null;
      const workstationList = input.workstations.sort((a, b) => a.sequenceOrder - b.sequenceOrder).map((w) => {
        const taktStatus = input.targetCycleTime ? w.cycleTime > input.targetCycleTime ? ` \u26A0\uFE0F \u8D85\u51FA Takt Time +${(w.cycleTime - input.targetCycleTime).toFixed(1)}s` : ` \u2713 \u9054\u6A19 (${(w.cycleTime / input.targetCycleTime * 100).toFixed(0)}%)` : "";
        return `  - ${w.name}\uFF1A\u5DE5\u5E8F\u6642\u9593 ${w.cycleTime}s\uFF0C\u4EBA\u54E1 ${w.manpower} \u4EBA${taktStatus}`;
      }).join("\n");
      const taktSummary = input.targetCycleTime && taktPassRate ? `
**Takt Time \u9054\u6A19\u7387\uFF1A** ${taktPassRate}% (${passStations.length}/${input.workstations.length} \u5DE5\u7AD9\u9054\u6A19)
**\u8D85\u51FA Takt Time \u5DE5\u7AD9\uFF1A** ${exceedStations.length > 0 ? exceedStations.map((w) => `${w.name}(${w.cycleTime}s)`).join("\u3001") : "\u7121"}` : "";
      const prompt = `\u4F60\u662F\u4E00\u4F4D\u7CBE\u901A\u7CBE\u5BE6\u751F\u7522\uFF08Lean Manufacturing\uFF09\u548C\u5DE5\u696D\u5DE5\u7A0B\u7684\u5C08\u5BB6\u9867\u554F\u3002\u8ACB\u6839\u64DA\u4EE5\u4E0B\u7522\u7DDA\u6578\u64DA\uFF0C\u63D0\u4F9B\u5C08\u696D\u7684\u5E73\u8861\u512A\u5316\u5EFA\u8B70\uFF1A

**\u7522\u7DDA\u540D\u7A31\uFF1A** ${input.productionLineName}${taktTimeInfo}
**\u5DE5\u7AD9\u6578\u91CF\uFF1A** ${input.workstations.length} \u500B
**\u74F6\u9838\u5DE5\u7AD9\uFF1A** ${bottleneck?.name ?? "\u7121"} (${bottleneck?.cycleTime ?? 0}s)
**\u5E73\u5747\u5DE5\u5E8F\u6642\u9593\uFF1A** ${avgTime.toFixed(1)}s
**\u7522\u7DDA\u5E73\u8861\u7387\uFF1A** ${balanceRate}%${taktSummary}

**\u5404\u5DE5\u7AD9\u8CC7\u6599\uFF08\u542B Takt Time \u9054\u6A19\u72C0\u614B\uFF09\uFF1A**
${workstationList}

\u8ACB\u63D0\u4F9B\u4EE5\u4E0B\u5206\u6790\uFF08\u4F7F\u7528\u7E41\u9AD4\u4E2D\u6587\uFF0C\u683C\u5F0F\u6E05\u6670\uFF09\uFF1A

## 1. \u73FE\u6CC1\u8A3A\u65B7
\u5206\u6790\u76EE\u524D\u7522\u7DDA\u7684\u4E3B\u8981\u554F\u984C\u548C\u74F6\u9838\uFF0C\u7279\u5225\u8AAA\u660E Takt Time \u9054\u6A19\u60C5\u6CC1\uFF08\u82E5\u6709\u8A2D\u5B9A\uFF09\u3002

## 2. Takt Time \u9054\u6A19\u6539\u5584\u65B9\u6848
${input.targetCycleTime ? "\u91DD\u5C0D\u8D85\u51FA Takt Time \u7684\u5DE5\u7AD9\uFF0C\u63D0\u51FA\u5177\u9AD4\u7684\u5DE5\u5E8F\u58D3\u7E2E\u6216\u4EBA\u54E1\u8ABF\u914D\u65B9\u6848\u3002" : "\u5EFA\u8B70\u8A2D\u5B9A\u5408\u7406\u7684 Takt Time\uFF0C\u4E26\u8AAA\u660E\u5982\u4F55\u4F9D\u5BA2\u6236\u9700\u6C42\u8A08\u7B97\u3002"}

## 3. \u5E73\u8861\u512A\u5316\u5EFA\u8B70
\u5177\u9AD4\u8AAA\u660E\u5982\u4F55\u91CD\u65B0\u5206\u914D\u5DE5\u5E8F\u3001\u8ABF\u6574\u4EBA\u54E1\u914D\u7F6E\u4EE5\u63D0\u5347\u5E73\u8861\u7387\u3002

## 4. \u74F6\u9838\u6539\u5584\u65B9\u6848
\u91DD\u5C0D\u74F6\u9838\u5DE5\u7AD9\u63D0\u51FA3-5\u500B\u5177\u9AD4\u53EF\u884C\u7684\u6539\u5584\u63AA\u65BD\u3002

## 5. \u9810\u671F\u6548\u76CA
\u4F30\u7B97\u512A\u5316\u5F8C\u7684\u5E73\u8861\u7387\u63D0\u5347\u3001Takt Time \u9054\u6A19\u7387\u6539\u5584\u548C\u6548\u7387\u63D0\u5347\u5E45\u5EA6\u3002

## 6. \u5BE6\u65BD\u512A\u5148\u9806\u5E8F
\u6309\u91CD\u8981\u6027\u6392\u5217\u6539\u5584\u9805\u76EE\u7684\u5BE6\u65BD\u9806\u5E8F\u3002`;
      const ollamaRes = await fetch(`${ENV.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ENV.ollamaApiKey}`
        },
        body: JSON.stringify({
          model: ENV.ollamaModel,
          messages: [
            { role: "system", content: "\u4F60\u662F\u4E00\u4F4D\u7CBE\u901A\u7CBE\u5BE6\u751F\u7522\uFF08Lean Manufacturing\uFF09\u548C\u5DE5\u696D\u5DE5\u7A0B\u7684\u5C08\u5BB6\u9867\u554F\uFF0C\u64C5\u9577\u7522\u7DDA\u5E73\u8861\u5206\u6790\u548C\u6539\u5584\u5EFA\u8B70\u3002\u8ACB\u7528\u7E41\u9AD4\u4E2D\u6587\u56DE\u7B54\uFF0C\u683C\u5F0F\u6E05\u6670\u5C08\u696D\u3002" },
            { role: "user", content: prompt }
          ],
          stream: false
        })
      });
      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text();
        throw new Error(`Ollama API \u932F\u8AA4 (${ollamaRes.status}): ${errText}`);
      }
      const ollamaData = await ollamaRes.json();
      const content = ollamaData.message?.content ?? "\u7121\u6CD5\u751F\u6210\u5EFA\u8B70\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002";
      return { suggestion: content };
    })
  }),
  // ─── Snapshot Router ──────────────────────────────────────────────────────
  snapshot: router({
    listByLine: publicProcedure.input(z2.object({ productionLineId: z2.number().int().positive() })).query(async ({ input }) => {
      const rows = await getSnapshotsByLine(input.productionLineId);
      return rows.map((r) => ({
        ...r,
        balanceRate: Number(r.balanceRate),
        balanceLoss: Number(r.balanceLoss),
        totalTime: Number(r.totalTime),
        maxTime: Number(r.maxTime),
        minTime: Number(r.minTime),
        avgTime: Number(r.avgTime),
        taktTime: r.taktTime ? Number(r.taktTime) : null,
        taktPassRate: r.taktPassRate ? Number(r.taktPassRate) : null,
        upph: r.upph ? Number(r.upph) : null
      }));
    }),
    getById: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ input }) => {
      const row = await getSnapshotById(input.id);
      if (!row) throw new Error("Snapshot not found");
      return {
        ...row,
        balanceRate: Number(row.balanceRate),
        balanceLoss: Number(row.balanceLoss),
        totalTime: Number(row.totalTime),
        maxTime: Number(row.maxTime),
        minTime: Number(row.minTime),
        avgTime: Number(row.avgTime),
        taktTime: row.taktTime ? Number(row.taktTime) : null,
        taktPassRate: row.taktPassRate ? Number(row.taktPassRate) : null,
        upph: row.upph ? Number(row.upph) : null
      };
    }),
    create: publicProcedure.input(z2.object({
      productionLineId: z2.number().int().positive(),
      name: z2.string().min(1).max(255),
      note: z2.string().optional(),
      balanceRate: z2.number(),
      balanceLoss: z2.number(),
      totalTime: z2.number(),
      maxTime: z2.number(),
      minTime: z2.number(),
      avgTime: z2.number(),
      workstationCount: z2.number().int(),
      totalManpower: z2.number().int(),
      taktTime: z2.number().optional(),
      taktPassRate: z2.number().optional(),
      taktPassCount: z2.number().int().optional(),
      workstationsData: z2.array(z2.object({
        id: z2.number(),
        name: z2.string(),
        cycleTime: z2.number(),
        manpower: z2.number(),
        sequenceOrder: z2.number(),
        description: z2.string().optional()
      })),
      bottleneckName: z2.string().optional(),
      upph: z2.number().optional()
    })).mutation(async ({ input }) => {
      const enrichedWorkstations = await Promise.all(
        input.workstationsData.map(async (ws) => {
          const steps = await getActionStepsByWorkstation(ws.id);
          const totalStepSec = steps.reduce((s, st) => s + parseFloat(String(st.duration)), 0);
          const valueAddedSec = steps.filter((s) => s.actionType === "value_added").reduce((s, st) => s + parseFloat(String(st.duration)), 0);
          const nonValueAddedSec = steps.filter((s) => s.actionType === "non_value_added").reduce((s, st) => s + parseFloat(String(st.duration)), 0);
          const necessaryWasteSec = steps.filter((s) => s.actionType === "necessary_waste").reduce((s, st) => s + parseFloat(String(st.duration)), 0);
          const valueAddedRate = totalStepSec > 0 ? parseFloat((valueAddedSec / totalStepSec * 100).toFixed(2)) : null;
          return {
            ...ws,
            // 動作拆解摘要
            actionStepCount: steps.length,
            totalStepSec: parseFloat(totalStepSec.toFixed(2)),
            valueAddedSec: parseFloat(valueAddedSec.toFixed(2)),
            nonValueAddedSec: parseFloat(nonValueAddedSec.toFixed(2)),
            necessaryWasteSec: parseFloat(necessaryWasteSec.toFixed(2)),
            valueAddedRate
            // null 表示該工站無動作拆解資料
          };
        })
      );
      await createSnapshot({
        productionLineId: input.productionLineId,
        name: input.name,
        note: input.note ?? null,
        balanceRate: String(input.balanceRate),
        balanceLoss: String(input.balanceLoss),
        totalTime: String(input.totalTime),
        maxTime: String(input.maxTime),
        minTime: String(input.minTime),
        avgTime: String(input.avgTime),
        workstationCount: input.workstationCount,
        totalManpower: input.totalManpower,
        taktTime: input.taktTime != null ? String(input.taktTime) : null,
        taktPassRate: input.taktPassRate != null ? String(input.taktPassRate) : null,
        taktPassCount: input.taktPassCount ?? null,
        workstationsData: enrichedWorkstations,
        bottleneckName: input.bottleneckName ?? null,
        upph: input.upph != null ? String(input.upph) : null
      });
      return { success: true };
    }),
    delete: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
      await deleteSnapshot(input.id);
      return { success: true };
    }),
    getAllLinesLatest: publicProcedure.query(async () => {
      const rows = await getAllLinesLatestSnapshot();
      return rows;
    }),
    getAllLinesHistory: publicProcedure.query(async () => {
      const rows = await getAllLinesSnapshotHistory();
      return rows;
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// api/index.ts
import path from "path";
import fs from "fs";
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
registerOAuthRoutes(app);
app.use("/api/trpc", createExpressMiddleware({
  router: appRouter,
  createContext
}));
var DIST_PATH = path.resolve(__dirname, "..", "dist", "public");
app.use(express.static(DIST_PATH));
app.use("*", (_req, res) => {
  const indexPath = path.resolve(DIST_PATH, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Not found");
  }
});
var index_default = app;
export {
  index_default as default
};
