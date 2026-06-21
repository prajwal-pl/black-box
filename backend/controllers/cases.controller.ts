import { type RequestHandler } from "express";

import db from "../lib/db";

export const getCases: RequestHandler = async (req, res) => {
    try {
        const cases = await db.case.findMany();

        if (!cases) {
            return res.status(404).json({ message: "No cases found" });
        }

        res.json({ message: "Cases fetched successfully: ", cases });
    } catch (error) {
        console.error("Error fetching cases:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const createCase: RequestHandler = (req, res) => {
    const { name, description } = req.body;
    // const userId = req.userId; 
    try {

    } catch (error) {
        console.error("Error creating case:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getCaseById: RequestHandler = (req, res) => { }

export const updateCase: RequestHandler = (req, res) => { }

export const deleteCase: RequestHandler = (req, res) => { }