import { users, documents, recipients, projects } from "@shared/schema";
import type { User, InsertUser, Document, InsertDocument, Recipient, InsertRecipient, Project, InsertProject } from "@shared/schema";
import { db, pool } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  getRecipient(id: number): Promise<Recipient | undefined>;
  createRecipient(recipient: InsertRecipient): Promise<Recipient>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
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

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error('[Storage] Error fetching user:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error('[Storage] Error fetching user by username:', error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    } catch (error) {
      console.error('[Storage] Error creating user:', error);
      throw error;
    }
  }

  async getDocument(id: number): Promise<Document | undefined> {
    try {
      const [doc] = await db.select().from(documents).where(eq(documents.id, id));
      return doc;
    } catch (error) {
      console.error('[Storage] Error fetching document:', error);
      throw error;
    }
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    try {
      const [newDoc] = await db.insert(documents).values(doc).returning();
      return newDoc;
    } catch (error) {
      console.error('[Storage] Error creating document:', error);
      throw error;
    }
  }

  async getRecipient(id: number): Promise<Recipient | undefined> {
    try {
      const [recipient] = await db.select().from(recipients).where(eq(recipients.id, id));
      return recipient;
    } catch (error) {
      console.error('[Storage] Error fetching recipient:', error);
      throw error;
    }
  }

  async createRecipient(recipient: InsertRecipient): Promise<Recipient> {
    try {
      const [newRecipient] = await db.insert(recipients).values(recipient).returning();
      return newRecipient;
    } catch (error) {
      console.error('[Storage] Error creating recipient:', error);
      throw error;
    }
  }

  async getProject(id: number): Promise<Project | undefined> {
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      return project;
    } catch (error) {
      console.error('[Storage] Error fetching project:', error);
      throw error;
    }
  }

  async createProject(project: InsertProject): Promise<Project> {
    try {
      const [newProject] = await db.insert(projects).values(project).returning();
      return newProject;
    } catch (error) {
      console.error('[Storage] Error creating project:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();