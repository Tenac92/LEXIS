import { users, generatedDocuments } from "@shared/schema";
import type { User, GeneratedDocument, InsertGeneratedDocument } from "@shared/schema";
import { db, pool } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createGeneratedDocument(doc: InsertGeneratedDocument): Promise<GeneratedDocument>;
  getGeneratedDocument(id: number): Promise<GeneratedDocument | undefined>;
  listGeneratedDocuments(): Promise<GeneratedDocument[]>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error('[Storage] Error fetching user:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error('[Storage] Error fetching user by email:', error);
      throw error;
    }
  }

  async createGeneratedDocument(doc: InsertGeneratedDocument): Promise<GeneratedDocument> {
    try {
      const [newDoc] = await db.insert(generatedDocuments).values(doc).returning();
      return newDoc;
    } catch (error) {
      console.error('[Storage] Error creating generated document:', error);
      throw error;
    }
  }

  async getGeneratedDocument(id: number): Promise<GeneratedDocument | undefined> {
    try {
      const [doc] = await db.select().from(generatedDocuments).where(eq(generatedDocuments.id, id));
      return doc;
    } catch (error) {
      console.error('[Storage] Error fetching generated document:', error);
      throw error;
    }
  }

  async listGeneratedDocuments(): Promise<GeneratedDocument[]> {
    try {
      return await db.select().from(generatedDocuments).orderBy(generatedDocuments.created_at);
    } catch (error) {
      console.error('[Storage] Error listing generated documents:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();