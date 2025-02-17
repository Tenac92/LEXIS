const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User.js");
const { authenticateToken } = require("../middleware/authMiddleware.js");
const router = express.Router();

const SECRET_KEY = process.env.JWT_SECRET || "your-secret-key";

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Add request timeout handler
  req.setTimeout(30000); // 30 second timeout

  try {
    if (!email || !password) {
      return res.status(400).json({ 
        status: 'error',
        message: "Email and password are required",
        code: 'VALIDATION_ERROR'
      });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: "Invalid input format",
        code: 'VALIDATION_ERROR'
      });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role || 'user',
      name: user.name,
      units: Array.isArray(user.units) ? user.units : [],
      department: user.department || null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days expiration
    };

    const token = jwt.sign(
      tokenPayload,
      SECRET_KEY,
      { 
        algorithm: 'HS256'
      }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email,
        name: user.name, 
        role: user.role || 'user',
        units: user.units || [],
        department: user.department || null
      } 
    });
  } catch (error) {
    console.error("Login error:", error);
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ 
        status: 'error',
        message: "Request timeout",
        code: 'REQUEST_TIMEOUT'
      });
    }
    return res.status(500).json({ 
      status: 'error',
      message: "Server error",
      code: 'INTERNAL_ERROR'
    });
  }
});

router.post("/verify", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ 
      status: 'error',
      message: "No token provided",
      code: 'TOKEN_MISSING'
    });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    res.setHeader('Content-Type', 'application/json');
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    res.status(401).json({ 
      status: 'error',
      message: "Invalid token",
      code: 'INVALID_TOKEN'
    });
  }
});

// Change password endpoint
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(userId, hashedPassword);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post("/refresh", async (req, res) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, SECRET_KEY, { ignoreExpiration: true });
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name,
        units: Array.isArray(user.units) ? user.units : [],
        department: user.department,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days expiration
      },
      SECRET_KEY,
      { }
    );
    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
});

module.exports = router;