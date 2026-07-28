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

dotenv.config();

const port = process.env.PORT || 3001;

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/cases", casesRoutes);
app.use("/", evidenceRoutes);
app.use("/", hypothesisRoutes);
app.use("/", timelineRoutes);
app.use("/", reasoningRoutes);
app.use("/", graphRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});