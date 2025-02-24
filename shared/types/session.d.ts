import 'express-session';
import type { User } from '@shared/schema';

declare module 'express-session' {
  interface SessionData {
    user?: Partial<User>;
  }
}

declare module 'express' {
  interface Request {
    user?: Partial<User>;
  }
}