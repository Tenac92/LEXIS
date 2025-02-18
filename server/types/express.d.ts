import { User } from '@shared/schema';
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: User;
  }
}

declare module 'express' {
  interface Request {
    user?: User;
  }
}
