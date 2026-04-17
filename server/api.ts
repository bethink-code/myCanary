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
import { registerSupplyRoutes } from "./supplies";
import { registerMovementRoutes } from "./movements/routes";
import { clientContext } from "./clientContext";

const app = express();
const PgSession = connectPgSimple(session);

// Trust Vercel's proxy so Express sees HTTPS, not HTTP
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: ["https://mycanary.biz", "https://www.mycanary.biz"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

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
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/auth/google", passport.authenticate("google"));
app.get(
  "/auth/callback",
  passport.authenticate("google", { failureRedirect: "/?error=auth_failed" }),
  (_req, res) => res.redirect("/")
);
app.post("/auth/logout", (req, res) => {
  req.logout(() => res.json({ ok: true }));
});

app.use(clientContext);

const router = express.Router();
registerRoutes(router);
registerXeroRoutes(router);
registerXeroAuthRoutes(router);
registerPnpRoutes(router);
registerOpeningBalanceRoutes(router);
registerSupplyRoutes(router);
registerMovementRoutes(router);
app.use(router);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});

export default app;
