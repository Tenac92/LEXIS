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
    file?: Express.Multer.File;
  }
}

// Extend multer types
declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }
  }
}
