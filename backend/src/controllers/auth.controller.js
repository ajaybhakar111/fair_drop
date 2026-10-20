import argon2 from "argon2";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import { env } from "../config/env.js";

// ============================================================
// COOKIE OPTIONS
// ============================================================

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000
};

// ============================================================
// CREATE JWT
// ============================================================

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN
    }
  );
}

// ============================================================
// REGISTER
// POST /api/v1/auth/register
// ============================================================

export async function register(req, res, next) {
  try {
    const {
      name,
      email,
      password
    } = req.body;

    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "name, email and password are required"
        }
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Password must be at least 8 characters"
        }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // --------------------------------------------------------
    // Check existing user
    // --------------------------------------------------------

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: "USER_ALREADY_EXISTS",
          message: "User with this email already exists"
        }
      });
    }

    // --------------------------------------------------------
    // Hash password
    // --------------------------------------------------------

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id
    });

    // --------------------------------------------------------
    // Create user
    // --------------------------------------------------------

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "USER"
    });

    // --------------------------------------------------------
    // Create authentication token
    // --------------------------------------------------------

    const token = createToken(user);

    res.cookie(
      env.COOKIE_NAME,
      token,
      cookieOptions
    );

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      },
      message: "Registration successful"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// LOGIN
// POST /api/v1/auth/login
// ============================================================

export async function login(req, res, next) {
  try {
    const {
      email,
      password
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "email and password are required"
        }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password"
        }
      });
    }

    const passwordValid = await argon2.verify(
      user.passwordHash,
      password
    );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password"
        }
      });
    }

    const token = createToken(user);

    res.cookie(
      env.COOKIE_NAME,
      token,
      cookieOptions
    );

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      },
      message: "Login successful"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// LOGOUT
// POST /api/v1/auth/logout
// ============================================================

export async function logout(req, res, next) {
  try {
    res.clearCookie(
      env.COOKIE_NAME,
      cookieOptions
    );

    return res.status(200).json({
      success: true,
      message: "Logout successful"
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET CURRENT USER
// GET /api/v1/auth/me
// ============================================================

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(
      req.user.id
    ).select("-passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "User account no longer exists"
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user
      },
      message: "Authenticated user fetched successfully"
    });
  } catch (error) {
    next(error);
  }
}