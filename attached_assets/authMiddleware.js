const { ApiError } = require('../utils/apiErrorHandler.js');
const getAuthToken = require('../utils/getAuthToken.js');
const { supabase } = require('../config/db.js');

const authenticateToken = async (req, res, next) => {
  try {
    const token = getAuthToken(req);
    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      throw new ApiError(401, 'Invalid or expired token');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authenticateToken, requireAdmin };