import { Router, Request, Response } from "express";
import pool from "../db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

pool.connect();

export const userRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "secret_password";
const SALT_ROUNDS = 10;

// Register Route
userRouter.post("/register", async (req: Request, res: Response) => {
    try {
        const { fullName, email, password } = req.body;

        // Validation
        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        // Check if user already exists
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "User with this email already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Insert new user
        const result = await pool.query(
            `INSERT INTO users (full_name, email, password, created_at) 
             VALUES ($1, $2, $3, NOW()) 
             RETURNING id, full_name, email, created_at`,
            [fullName, email.toLowerCase(), hashedPassword]
        );

        const newUser = result.rows[0];

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: newUser.id,
                email: newUser.email
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                user: {
                    id: newUser.id,
                    fullName: newUser.full_name,
                    email: newUser.email,
                    createdAt: newUser.created_at
                },
                token
            }
        });

    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// Login Route
userRouter.post("/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find user by email
        const result = await pool.query(
            "SELECT id, full_name, email, password, created_at FROM users WHERE email = $1",
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user: {
                    id: user.id,
                    fullName: user.full_name,
                    email: user.email,
                    createdAt: user.created_at
                },
                token
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// Get current user (protected route example)
userRouter.get("/me", async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "No token provided"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };

        const result = await pool.query(
            "SELECT id, full_name, email, created_at FROM users WHERE id = $1",
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const user = result.rows[0];

        res.status(200).json({
            success: true,
            data: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({
                success: false,
                message: "Invalid token"
            });
        }
        console.error("Get user error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});