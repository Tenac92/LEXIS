import { Request, Response, NextFunction } from 'express';

export function authenticateSession(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}
