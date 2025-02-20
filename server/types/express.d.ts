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

interface User {
    id: number;
    email: string;
    role: string;
    name: string | null;
    units: string | null;
    telephone: string | null;
    department: string | null;
}