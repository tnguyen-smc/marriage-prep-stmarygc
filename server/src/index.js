import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import templateRoutes from "./routes/templates.js";
import coupleRoutes from "./routes/couples.js";
import priestRoutes from "./routes/priests.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: process.env.COOKIE_SAMESITE || "lax",
      secure: process.env.COOKIE_SECURE === "true",
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
