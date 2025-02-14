import { validationResult } from 'express-validator';

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array(),
      timestamp: new Date().toISOString()
    });
  }
  next();
}

module.exports = validateRequest;
