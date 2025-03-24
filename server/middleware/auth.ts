// TODO: Refactor - Authentication middleware is duplicated across multiple files
// This file re-exports from auth.ts while authMiddleware.ts has its own implementation
// Consider consolidating all authentication logic into a single location
import { authenticateSession } from '../auth';
export { authenticateSession };