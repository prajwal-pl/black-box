import { type RequestHandler } from "express";

import db from "../lib/db";

export const getCases: RequestHandler = async (req, res) => {
    const userId = req.userId;
    try {
        const cases = await db.case.findMany({
            where: { userId: userId as string },
        });

        res.json({ message: "Cases fetched successfully: ", cases });
    } catch (error) {
        console.error("Error fetching cases:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const createCase: RequestHandler = async (req, res) => {
    const { name } = req.body;
    const userId = req.userId;
    try {
        if (!name) {
            return res.status(400).json({ message: "Name is required" });
        }

        const newCase = await db.case.create({
            data: {
                name,
                userId: userId as string,
            },
        });

        res.status(201).json({ message: "Case created successfully", case: newCase });

    } catch (error) {
        console.error("Error creating case:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getCaseById: RequestHandler = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    try {
        if (!id) {
            return res.status(400).json({ message: "Case ID is required" });
        }

        const caseItem = await db.case.findUnique({
            where: {
                id: id as string,
                userId: userId as string,
            },
        });

        if (!caseItem) {
            return res.status(404).json({ message: "Case not found" });
        }

        res.json({ message: "Case fetched successfully", case: caseItem });

    } catch (error) {
        console.error("Error fetching case by ID:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const updateCase: RequestHandler = (req, res) => { }

export const deleteCase: RequestHandler = (req, res) => { }