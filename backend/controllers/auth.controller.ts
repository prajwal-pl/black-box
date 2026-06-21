import { type RequestHandler } from "express";
import bcrypt from "bcrypt";
import db from "../lib/db";

import jwt from "jsonwebtoken";

export const register: RequestHandler = async (req, res) => {
    const { email, password, name } = req.body;
    try {
        if (!email || !password || !name) {
            return res.status(400).json({ message: "Email, password, and name are required" });
        }

        // Check if the user already exists
        const existingUser = await db.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const newUser = await db.user.create({
            data: {
                email,
                password: hashedPassword,
                name // In a real application, make sure to hash the password before storing it
            },
        });

        const token = jwt.sign({ userId: newUser.id }, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: '3d' });

        res.status(201).json({ message: "User registered successfully", user: newUser, token: token });

    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const login: RequestHandler = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await db.user.findUnique({
            where: { email }
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ userId: user.id }, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: '3d' });

        res.json({ message: "Login successful", user, token });
    } catch (error) {
        console.error("Error logging in user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const googleAuth: RequestHandler = (req, res) => { }