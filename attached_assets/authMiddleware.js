
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        status: 'error',
        message: 'Authorization header missing',
        code: 'AUTH_HEADER_MISSING'
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authorization header format',
        code: 'INVALID_AUTH_HEADER'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication token required',
        code: 'TOKEN_MISSING'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      if (!decoded.userId || !decoded.email) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token payload',
          code: 'INVALID_TOKEN_PAYLOAD'
        });
      }

      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < currentTime) {
        return res.status(401).json({
          status: 'error',
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED',
          shouldRefresh: true
        });
      }

      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user',
        name: decoded.name,
        department: decoded.department || null,
        units: Array.isArray(decoded.units) ? decoded.units : 
          (typeof decoded.units === 'string' ? JSON.parse(decoded.units) : [])
      };
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED',
          shouldRefresh: true
        });
      }
      return res.status(403).json({
        status: 'error',
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication processing failed',
      code: 'AUTH_ERROR'
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

module.exports = { authenticateToken, requireAdmin };
