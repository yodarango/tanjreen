import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

/**
 * Middleware to verify JWT token
 * Checks for token in Authorization header (Bearer token) or query parameter
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  let token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  // If no token in header, check query parameter (for direct download links)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || "your-secret-key-change-this";
    const verified = jwt.verify(token, jwtSecret);
    req.user = verified;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token." });
  }
}
