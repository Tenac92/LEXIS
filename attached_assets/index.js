
const express = require('express');
const router = express.Router();

const authRoutes = require("./authController.js");
const userRoutes = require("./usersController.js");
const catalogRoutes = require("./catalogController.js");
const csvUploadRoutes = require("./csvUploadController.js");
const documentsRoutes = require("./documentsController.js");
const statsRoutes = require("./statsController.js");
const budgetRoutes = require("./budgetController.js");

// Mount all routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/catalog', catalogRoutes);
router.use('/csv', csvUploadRoutes);
router.use('/documents', documentsRoutes);
router.use('/stats', statsRoutes);
router.use('/budget', budgetRoutes);

module.exports = router;
