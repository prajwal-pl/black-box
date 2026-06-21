import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth";
import casesRoutes from "./routes/cases";

dotenv.config();

const port = process.env.PORT || 3001;

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/cases", casesRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});