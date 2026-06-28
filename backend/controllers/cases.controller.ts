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

export const createCase: RequestHandler = async (req, res) => {
    const { name, description } = req.body;
    const userId = req.userId;
    try {
        if (!name || !description) {
            return res.status(400).json({ message: "Name and description are required" });
        }

        const newCase = await db.case.create({
            data: {
                name,
                description,
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
    try {
        if (!id) {
            return res.status(400).json({ message: "Case ID is required" });
        }

        const caseItem = await db.case.findUnique({
            where: {
                id: id as string
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