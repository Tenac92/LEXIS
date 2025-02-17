
const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User.js");
const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware.js");
const router = express.Router();

// Get users by unit
router.get("/by-unit/:unit", authenticateToken, async (req, res) => {
  try {
    const users = await User.findByUnit(req.params.unit);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users by unit" });
  }
});

// Get all users (admin only)
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Get user units
router.get("/units/:userId", authenticateToken, async (req, res) => {
  try {
    if (!req.params.userId) {
      return res.status(400).json({ 
        status: 'error',
        message: "User ID is required",
        code: 'MISSING_USER_ID'
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: "User not found",
        code: 'USER_NOT_FOUND'
      });
    }

    const parsedUnits = user.units || [];
    console.log(`Units for user ${req.params.userId}:`, parsedUnits);
    
    res.json({ 
      status: 'success',
      units: parsedUnits,
      count: parsedUnits.length
    });
  } catch (error) {
    console.error(`Error fetching units for user ${req.params.userId}:`, error);
    res.status(500).json({ 
      status: 'error',
      message: "Failed to fetch user units",
      code: 'FETCH_UNITS_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new user (admin only)
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role, units, telephone } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role, units, telephone });
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ message: error.message || "Error creating user" });
  }
});

// Update user units
router.put("/:userId/units", authenticateToken, requireAdmin, async (req, res) => {

// Get user department
router.get("/:userId/department", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: "User not found",
        code: 'USER_NOT_FOUND'
      });
    }
    
    res.json({ 
      status: 'success',
      department: user.department
    });
  } catch (error) {
    console.error(`Error fetching department for user ${req.params.userId}:`, error);
    res.status(500).json({ 
      status: 'error',
      message: "Failed to fetch user department",
      code: 'FETCH_DEPARTMENT_ERROR'
    });
  }
});

  try {
    const { units } = req.body;
    await User.updateUnits(req.params.userId, units);
    res.json({ message: "Units updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating units" });
  }
});

// Delete user
router.delete("/:userId", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await User.delete(req.params.userId);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user" });
  }
});

// Get single user
router.get("/:userId", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user" });
  }
});

// Update user
router.put("/:userId", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, role, telephone, units } = req.body;
    await User.update(req.params.userId, { name, email, role, telephone, units });
    res.json({ message: "User updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Error updating user" });
  }
});

module.exports = router;
