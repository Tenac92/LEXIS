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

### June 19, 2025 - Project Lines System with 5-Level Cascading Region Dropdowns
- Completely replaced old field-specific editing with comprehensive project lines management system
- Implemented 5-level cascading geographic region dropdowns using kallikratis table structure
- Created hierarchical region selection: Περιφέρεια → Περιφερειακή Ενότητα → Δήμος → Δημοτική Ενότητα → Τοπική Κοινότητα
- Added kallikratis API endpoint with proper data filtering and ordering capabilities
- Integrated multi-select expenditure types with visual button-based interface
- Fixed implementing agency population from Monada table with proper unit_name display
- Added clear selection options for all cascading dropdown levels (2-5) for better user control
- Optimized project edit modal with streamlined tabbed interface focusing on project configuration

#### Technical Implementation Details
- **Kallikratis Integration**: Created `/api/kallikratis` endpoint returning 1000+ geographic entries with proper hierarchical filtering
- **Cascading Logic**: Implemented intelligent dropdown filtering with automatic dependent field reset when parent selections change
- **Project Lines Architecture**: Replaced individual field editing with structured project line objects containing agency, region hierarchy, and expenditure types
- **Data Flow Optimization**: Fixed TypeScript errors and improved data mapping between frontend components and backend APIs
- **User Experience Enhancement**: Added visual expenditure type selection buttons and clear selection options for all hierarchy levels

### June 18, 2025 - Complete Project Index Schema Implementation & Audit
- Created optimized `project_index` table with composite primary key structure
- Populated reference tables with authentic CSV export data (15 event types, 8 expenditure types)
- Implemented intelligent alphanumerical value matching between Projects CSV and reference tables
- Successfully mapped 693 project combinations with proper ID relationships
- Achieved 175ms query performance for complex filtering operations
- Validated all foreign key relationships and data integrity

#### Comprehensive API Endpoint Updates
- **GET /api/projects**: Enhanced with full project_index schema integration including expenditure_types and event_types arrays
- **GET /api/projects/:mis**: Updated with optimized schema and enhanced data structure
- **PATCH /api/projects/:mis**: Implemented enhanced data updates with project_index relationships
- **GET /api/projects/cards**: Built using optimized project_index schema with performance optimization
- **GET /api/projects-working/:unitName**: Fixed expenditure types mapping and implemented full optimized schema
- **GET /api/unit-projects/:unitName**: Converted from legacy JSONB filtering to optimized project_index lookup
- **GET /api/projects/:mis/regions**: Added missing endpoint with optimized schema support
- **POST /api/documents**: Enhanced document controller with project_index schema integration
- **Export functions**: Updated Excel export with enhanced project data from optimized schema

#### Controller-Level Comprehensive Updates
- **projectController.ts**: All endpoints now use project_index schema with enhanced data structures
- **documentsController.ts**: Document creation workflows updated to use optimized schema lookups
- **budgetController.ts**: Project lookups enhanced with optimized schema support
- **routes.ts**: All project-related routes consistently use project_index schema

#### Frontend Component Updates
- **OptimizedProjectCard**: Enhanced data display with expenditure types and organizational units
- **ComprehensiveProjectsModal**: Updated with optimized data structure
- **create-document-dialog**: Fixed expenditure types population using enhanced schema data
- **Project detail/edit pages**: Enhanced with optimized data structure display

#### Data Integrity & Performance
- Fixed all SelectItem component errors with proper validation
- Resolved expenditure types (Τύπος Δαπάνης) not populating in document creation dialog
- Implemented consistent expenditure_types arrays across all endpoints
- Fixed TypeScript errors and Set iteration compatibility issues
- Verified complete document creation flow works with optimized database structure

### June 18, 2025 - Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.