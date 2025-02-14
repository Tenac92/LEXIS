const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { supabase } = require("../config/db.js");
const { authenticateToken } = require("../middleware/authMiddleware.js");
const { ApiError } = require("../utils/apiErrorHandler.js");
const router = express.Router();

const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password?.trim()) {
    throw new ApiError(400, "Email and password are required");
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = jwt.sign(
    { 
      userId: user.id,
      email: user.email,
      role: user.role,
      units: user.units
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user: { ...user, password: undefined } });
}));

router.post("/verify", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

router.post("/change-password", authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword?.trim() || !newPassword?.trim()) {
    throw new ApiError(400, "Current and new passwords are required");
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('password')
    .eq('id', req.user.userId)
    .single();

  if (error || !user) {
    throw new ApiError(404, "User not found");
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await supabase
    .from('users')
    .update({ password: hashedPassword })
    .eq('id', req.user.userId);

  res.json({ message: "Password updated successfully" });
}));

module.exports = router;