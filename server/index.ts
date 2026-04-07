import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import cors from "cors";
import passport from "./auth";
import { registerRoutes } from "./routes";
import { registerXeroRoutes } from "./xeroImport";
import { registerPnpRoutes } from "./pnpProcess";
import { registerXeroAuthRoutes } from "./xeroAuth";
import { registerOpeningBalanceRoutes } from "./openingBalanceImport";

const app = express();
const PgSession = connectPgSimple(session);

// ─── Security ──────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              imgSrc: ["'self'", "data:", "https:"],
              connectSrc: ["'self'", "ws:", "wss:"],
            },
          },
  })
);

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.PRODUCTION_URL
        : ["http://localhost:5173", "http://localhost:5000"],
    credentials: true,
  })
);

// ─── Rate Limiting (simple in-memory) ──────────────────
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
app.use((req, res, next) => {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
    return next();
  }
  entry.count++;
  if (entry.count > 200) {
    return res.status(429).json({ message: "Too many requests. Please try again later." });
  }
  next();
});

// ─── Body Parsing ──────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Sessions ──────────────────────────────────────────
app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

// ─── Passport ──────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ─── Auth Routes ───────────────────────────────────────
const clientUrl =
  process.env.NODE_ENV === "production" ? "/" : "http://localhost:5173";

app.get("/auth/google", passport.authenticate("google"));

app.get(
  "/auth/callback",
  passport.authenticate("google", {
    failureRedirect: `${clientUrl}?error=auth_failed`,
  }),
  (_req, res) => {
    res.redirect(clientUrl);
  }
);

app.post("/auth/logout", (req, res) => {
  req.logout(() => {
    res.json({ ok: true });
  });
});

// ─── API Routes ────────────────────────────────────────
const router = express.Router();
registerRoutes(router);
registerXeroRoutes(router);
registerXeroAuthRoutes(router);
registerPnpRoutes(router);
registerOpeningBalanceRoutes(router);
app.use(router);

// ─── Error Handler ─────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong. Please try again."
        : err.message,
  });
});

// ─── Start ─────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "5000", 10);
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
