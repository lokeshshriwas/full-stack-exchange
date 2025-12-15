// user.ts
import { Router, Request, Response } from "express";
import pool from "../db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

pool.connect();

export const userRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "secret_password";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "refresh_secret_password";
const SALT_ROUNDS = 10;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Cookie configuration
const getCookieConfig = (maxAge: number) => ({
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? ("strict" as const) : ("lax" as const),
  path: "/",
  maxAge,
});

// Generate tokens
const generateTokens = (userId: number, email: string) => {
  const accessToken = jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { userId, email },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

// Set auth cookies
const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
  rememberMe = false
) => {
  const accessMaxAge = 15 * 60 * 1000; // 15 minutes
  const refreshMaxAge = rememberMe
    ? 30 * 24 * 60 * 60 * 1000 // 30 days
    : 7 * 24 * 60 * 60 * 1000; // 7 days

  res.cookie("accessToken", accessToken, getCookieConfig(accessMaxAge));
  res.cookie("refreshToken", refreshToken, getCookieConfig(refreshMaxAge));
};

// Clear auth cookies
const clearAuthCookies = (res: Response) => {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
};

// Register Route
userRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, created_at) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING id, full_name, email, created_at`,
      [fullName, email.toLowerCase(), hashedPassword]
    );

    const newUser = result.rows[0];
    const { accessToken, refreshToken } = generateTokens(newUser.id, newUser.email);

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: newUser.id,
          fullName: newUser.full_name,
          email: newUser.email,
          createdAt: newUser.created_at,
        },
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Login Route
userRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await pool.query(
      "SELECT id, full_name, email, password, created_at FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    setAuthCookies(res, accessToken, refreshToken, rememberMe);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          createdAt: user.created_at,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Logout Route
userRouter.post("/logout", (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// Refresh Token Route
userRouter.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token",
      });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as {
      userId: number;
      email: string;
    };

    const result = await pool.query(
      "SELECT id, email FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const user = result.rows[0];
    const tokens = generateTokens(user.id, user.email);

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    res.status(200).json({
      success: true,
      message: "Token refreshed",
    });
  } catch (error) {
    clearAuthCookies(res);

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get Current User
userRouter.get("/me", async (req: Request, res: Response) => {
  try {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(accessToken, JWT_SECRET) as {
      userId: number;
      email: string;
    };

    const result = await pool.query(
      "SELECT id, full_name, email, created_at FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Token expired",
        code: "TOKEN_EXPIRED",
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});