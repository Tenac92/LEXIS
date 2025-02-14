const errorMiddleware = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    code: err.code || 'INTERNAL_ERROR'
  });
};

module.exports = errorMiddleware;