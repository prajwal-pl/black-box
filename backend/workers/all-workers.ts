import dotenv from "dotenv";
dotenv.config();

// Import all 4 workers — each file registers its BullMQ Worker() on import
import "./ingestion.worker";
import "./processing.worker";
import "./reasoning.worker";
import "./graph.worker";

console.log("✅ All 4 BullMQ workers started.");

// Keep process alive and handle graceful shutdown
// (each individual worker file handles its own SIGTERM cleanup)
process.on("unhandledRejection", (reason, promise) => {
    console.error("[WORKERS] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("[WORKERS] Uncaught Exception:", err);
    process.exit(1);
});
