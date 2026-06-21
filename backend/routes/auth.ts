import express from "express";
import { googleAuth, login, register } from "../controllers/auth.controller";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/google", googleAuth);


export default router;