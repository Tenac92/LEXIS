import { User } from '@shared/schema';
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: User;
    geoVerified?: boolean;
    geoVerifiedAt?: string;
    geoVerifiedIp?: string;
    geoVerifiedCountry?: string;
    createdAt?: Date;
    diagnostic?: {
      lastChecked?: string;
      accessCount?: number;
      [key: string]: any;
    };
  }
}

declare module 'express' {
  interface Request {
    user?: User;
    file?: Express.Multer.File;
  }
}

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
