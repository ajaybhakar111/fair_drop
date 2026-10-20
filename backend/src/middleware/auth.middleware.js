import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[env.COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "Authentication required"
        }
      });
    }

    const decoded = jwt.verify(
      token,
      env.JWT_SECRET
    );

    req.user = {
      id: decoded.sub,
      role: decoded.role
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Invalid or expired authentication"
      }
    });
  }
}