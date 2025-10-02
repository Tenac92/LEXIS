# Overview

This is a comprehensive document management system specifically designed for the Greek Civil Protection agency, built with a full-stack TypeScript architecture. The system handles budget management, project tracking, document generation, employee and beneficiary management, with features like real-time notifications, PDF document generation, and comprehensive budget monitoring with quarterly transitions.

# Recent Changes

## October 2, 2025 - Beneficiary Freetext Field Support
- **Issue**: The `secondary_text` field from AFM autocomplete (populated from `personData.freetext` or `personData.attribute`) was not being saved to the `beneficiary_payments` table
- **Solution**: 
  - Updated `shared/schema.ts` to include `freetext` column in `beneficiaryPayments` table schema (line 418)
  - Modified `server/controllers/documentsController.ts` to map `recipient.secondary_text` from frontend to `freetext` column when creating beneficiary payment records (lines 874 and 930)
  - The frontend sends `secondary_text`, which is correctly mapped to the database column `freetext` during payment creation
- **Impact**: When creating documents with recipients, any additional text from the AFM autocomplete (profession, department, etc.) is now properly saved and can be retrieved with beneficiary payment records

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development
- **UI Components**: Radix UI primitives with shadcn/ui components for consistent design
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query for server state management and data fetching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation schemas

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Originally Drizzle, migrated to direct Supabase client calls
- **Session Management**: Express-session with memory store
- **Authentication**: Custom JWT-like session system with role-based access control
- **WebSocket**: Native WebSocket server for real-time budget updates and notifications
- **File Processing**: XLSX parsing for budget uploads, PDF generation for documents

## Data Storage Solutions
- **Primary Database**: Supabase (PostgreSQL) with Row Level Security
- **Schema Management**: Drizzle schema definitions in TypeScript
- **Migration Strategy**: Drizzle migrations with Supabase integration
- **Data Access**: Direct Supabase client calls replacing ORM layer
- **Connection Pooling**: Supabase managed connections with retry logic

## Authentication and Authorization
- **Session-based Authentication**: Express sessions with Supabase user verification
- **Role-based Access**: Admin, manager, and user roles with different permissions
- **Unit-based Authorization**: Users restricted to specific organizational units
- **CORS Configuration**: Special handling for sdegdaefk.gr domain integration
- **Geo-IP Restrictions**: Greece-only access with development environment exceptions

## Key Design Patterns
- **Service Layer**: Dedicated services for budget, notifications, and scheduling
- **Controller Pattern**: Express controllers for API route handling
- **Middleware Chain**: Authentication, CORS, security headers, and error handling
- **Error Recovery**: Database connection recovery with automatic retries
- **Real-time Updates**: WebSocket broadcasting for budget changes and notifications

## Performance Optimizations
- **Query Optimization**: Direct Supabase queries instead of ORM overhead
- **Connection Management**: Connection pooling with health checks
- **Caching Strategy**: Session-based caching with memory store
- **Bundle Optimization**: Vite-based building with code splitting

# External Dependencies

## Database Services
- **Supabase**: Primary database service (PostgreSQL) with real-time capabilities
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`

## Third-party APIs and Services
- **SendGrid**: Email service for notifications (`@sendgrid/mail`)
- **Anthropic AI**: AI integration for document assistance (`@anthropic-ai/sdk`)
- **MaxMind GeoIP**: Geographic IP restrictions (`@maxmind/geoip2-node`)

## Development and Build Tools
- **Vite**: Frontend build tool with React plugin
- **TypeScript**: Type checking and compilation
- **Drizzle Kit**: Database schema management and migrations
- **ESBuild**: Server-side bundling for production

## Frontend Libraries
- **React Query**: Server state management and caching
- **Radix UI**: Unstyled, accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Wouter**: Lightweight React router
- **React Hook Form**: Form state management with validation

## Backend Libraries
- **Express.js**: Web application framework
- **Multer**: File upload handling
- **XLSX**: Excel file processing for budget uploads
- **Helmet**: Security headers middleware
- **Node-cron**: Scheduled task management
- **BCrypt**: Password hashing and verification

## Integration Requirements
- **Greek Domain Integration**: Special CORS and middleware for sdegdaefk.gr
- **European Number Formatting**: Custom parsers for Greek number formats
- **Real-time Communication**: WebSocket server for live updates