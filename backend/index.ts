import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth";
import casesRoutes from "./routes/cases";
import evidenceRoutes from "./routes/evidence";
import hypothesisRoutes from "./routes/hypothesis";
import timelineRoutes from "./routes/timeline";
import reasoningRoutes from "./routes/reasoning";
import graphRoutes from "./routes/graph";
import aiRoutes from "./routes/ai";

dotenv.config();

const port = process.env.PORT || 3001;

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  process.env.CORS_ORIGIN,
].filter(Boolean) as string[];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// Health check — used by Docker HEALTHCHECK and load balancers
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/auth", authRoutes);
app.use("/cases", casesRoutes);
app.use("/", evidenceRoutes);
app.use("/", hypothesisRoutes);
app.use("/", timelineRoutes);
app.use("/", reasoningRoutes);
app.use("/", graphRoutes);
app.use("/ai", aiRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});