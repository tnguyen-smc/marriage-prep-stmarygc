import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import templateRoutes from "./routes/templates.js";
import coupleRoutes from "./routes/couples.js";
import priestRoutes from "./routes/priests.js";

const app = express();

// 1. Trust proxy required for Render/HTTPS proxying
app.set("trust proxy", 1);

// 2. Allow requests from both local dev and your GitHub Pages domain
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://tnguyen-smc.github.io",
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation"), false);
    },
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: (process.env.COOKIE_SAMESITE || "none").toLowerCase(),
      secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/couples", coupleRoutes);
app.use("/api/priests", priestRoutes);

app.get("/", (_req, res) => res.send("Marriage Prep API is running."));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));