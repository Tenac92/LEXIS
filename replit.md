# Replit.md

## Overview

This is a full-stack web application built for Greek government budget and document management. The application provides functionality for managing projects, budget allocations, beneficiaries, employees, and generating official documents. It uses a modern tech stack with React frontend, Express.js backend, and Supabase as the database provider.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and building
- **UI Components**: Radix UI components with shadcn/ui styling
- **State Management**: TanStack Query for server state management
- **Styling**: Tailwind CSS with custom theme configuration
- **Routing**: React Router (implied from the SPA structure)

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Session Management**: Express-session with MemoryStore
- **Authentication**: Custom session-based auth with bcrypt password hashing
- **Database ORM**: Drizzle ORM (configured but using direct Supabase calls)
- **WebSocket**: ws library for real-time budget updates
- **File Processing**: ExcelJS for Excel imports/exports, docx for document generation

### Database Architecture
- **Primary Database**: Supabase (PostgreSQL-based)
- **Migration Status**: Recently migrated from Neon DB to Supabase
- **Schema Management**: Drizzle ORM schema definitions
- **Key Tables**: users, Projects, budget_na853_split, budget_history, beneficiaries, employees, documents

## Key Components

### Authentication System
- Custom session-based authentication in `server/authentication.ts`
- User roles and unit-based access control
- Session storage using MemoryStore (migrated from PostgreSQL sessions)
- Cross-domain cookie support for sdegdaefk.gr integration

### Budget Management
- Real-time budget tracking with WebSocket updates
- Quarterly budget transitions with automated scheduling
- Budget history tracking and audit trails
- Excel import/export functionality for budget data
- Notification system for budget threshold alerts

### Document Generation
- Word document generation using docx library
- Support for multiple Greek government document types
- Template-based document creation with expenditure type handling
- Recipient data management and formatting

### Project Management
- Project identification using multiple identifiers (id, mis, na853)
- Project resolver utility for unified lookups
- Support for both legacy MIS codes and new project IDs

### Real-time Features
- WebSocket server for live budget updates
- Connection management and session validation
- Broadcast system for multi-user notifications

## Data Flow

### Authentication Flow
1. User submits credentials via login form
2. Server validates against Supabase users table
3. Session created with sanitized user data
4. Subsequent requests authenticated via session middleware

### Budget Update Flow
1. User modifies budget data through frontend
2. Backend validates changes and updates Supabase
3. Budget history entry created for audit trail
4. WebSocket broadcast sent to connected clients
5. Frontend updates reflect real-time changes

### Document Generation Flow
1. User selects recipients and document type
2. Backend fetches project and beneficiary data
3. Document generator creates Word document using templates
4. Generated document returned as downloadable file

## External Dependencies

### Third-party Services
- **Supabase**: Primary database and authentication provider
- **SendGrid**: Email service integration
- **MaxMind GeoIP**: Geographic IP restriction middleware

### Key Libraries
- **Frontend**: React, Radix UI, TanStack Query, Tailwind CSS
- **Backend**: Express, bcrypt, multer, node-cron, ws
- **Document Processing**: docx, ExcelJS
- **Database**: Supabase client, Drizzle ORM

### Development Tools
- **TypeScript**: Type safety across the stack
- **Vite**: Frontend build tool and development server
- **ESLint/Prettier**: Code quality and formatting (implied)

## Deployment Strategy

### Environment Configuration
- **Development**: Local development with Vite dev server
- **Production**: Cloud Run deployment (configured in .replit)
- **Environment Variables**: Supabase credentials, session secrets, CORS domains

### Build Process
1. Frontend assets built with Vite
2. Backend bundled with esbuild
3. Static files served from dist/public
4. Production server runs from dist/index.js

### Monitoring and Health Checks
- Health check endpoints for database connectivity
- Error recovery middleware for database issues
- Structured logging system with different log levels
- WebSocket connection management and cleanup

### Security Measures
- Helmet.js for security headers
- CORS middleware for cross-domain requests
- Geographic IP restrictions with whitelist
- Session-based authentication with secure cookies
- Input validation using Zod schemas

## Recent Changes

### June 18, 2025 - Database Optimization
- Created optimized `project_index` table with composite primary key structure
- Populated reference tables with authentic CSV export data (15 event types, 8 expenditure types)
- Implemented intelligent alphanumerical value matching between Projects CSV and reference tables
- Successfully mapped 693 project combinations with proper ID relationships
- Achieved 175ms query performance for complex filtering operations
- Validated all foreign key relationships and data integrity

### June 18, 2025 - Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.