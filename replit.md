# Overview

This is a comprehensive document management system specifically designed for the Greek Civil Protection agency, built with a full-stack TypeScript architecture. The system handles budget management, project tracking, document generation, employee and beneficiary management, with features like real-time notifications, PDF document generation, and comprehensive budget monitoring with quarterly transitions.

# Recent Changes

## October 17, 2025 - Budget Reconciliation for Employee/Beneficiary Payment Updates
- **Feature**: Budget reconciliation now triggers automatically when employee or beneficiary payment amounts are updated
- **Critical Fix - Project ID Conversion** (`server/controllers/documentsController.ts`):
  - Fixed project_index_id → project_id conversion issue in all budget reconciliation calls
  - Documents store project_index_id (from project_index table), but reconcileBudgetOnDocumentEdit expects project_id (from Projects table)
  - Added queries to fetch project_id from project_index records before calling budget reconciliation
  - Fixes "Project 1179 not found" errors in budget updates
- **PUT /api/documents/:id/beneficiaries Endpoint** (lines 3301-3432 employee payments, 3501-3611 beneficiary payments):
  - Calculate new total amount from all updated recipients
  - Update document's total_amount field when amounts change
  - Fetch project_id from project_index using the document's project_index_id
  - Call storage.reconcileBudgetOnDocumentEdit to update project_budget table
  - Budget reconciliation isolated from payment updates (doesn't block on failures)
- **PATCH /api/documents/:id Endpoint** (lines 2038-2093):
  - Enhanced to fetch both old and new project IDs from project_index before reconciliation
  - Handles project changes and amount changes with proper ID conversion
- **POST /api/documents/:id/correction Endpoint** (lines 2402-2457):
  - Same project_index_id → project_id conversion fix applied
  - Ensures corrections trigger proper budget updates
- **Comprehensive Error Logging**:
  - ERROR level: Project lookup failures, missing project_id in project_index records
  - WARNING level: Budget reconciliation skipped due to missing project IDs or user ID
  - All skip scenarios explicitly logged with document ID and project index IDs for debugging
  - Error isolation ensures document/payment updates succeed even if budget reconciliation fails
- **Impact**: Employee and beneficiary payment amount changes now automatically update project budgets with full error visibility. Budget inconsistencies from failed lookups are surfaced in logs for monitoring and investigation.

## October 15, 2025 - Full Document Editing with Budget Reconciliation
- **Feature**: Extended document editing capabilities to include all document fields with automatic budget reconciliation
- **Frontend Changes** (`client/src/components/documents/edit-document-modal.tsx`):
  - Added `project_index_id` and `unit_id` fields to form schema
  - Added queries to fetch units (`/api/public/units`) and projects (`/api/projects-working/${unit}`)
  - Implemented cascading unit → project selection with proper state management
  - Added UI fields in new "Έργο & Μονάδα" card section between document info and ESDIAN fields
  - Updated form reset and mutation payloads to include project and unit
- **Backend - Budget Reconciliation Service** (`server/storage.ts`):
  - Created `reconcileBudgetOnDocumentEdit()` function to handle budget updates when documents are edited
  - Handles 4 scenarios: project changed, amount changed, both changed, project added/removed
  - Implements compensating transaction logic: if adding to new project fails, restores old project budget before throwing error
  - Prevents budget inconsistencies with CRITICAL logging for double-failure scenarios
- **Backend - Document Endpoints** (`server/controllers/documentsController.ts`):
  - PATCH `/:id`: Fetches old project/amount, updates document, reconciles budget, broadcasts update
  - POST `/:id/correction`: Now supports project/unit/amount changes with budget reconciliation
  - Both endpoints handle budget errors gracefully without failing document updates
  - Added `storage` import for budget reconciliation access
- **Budget History**: All budget changes from document edits are logged with proper audit trail
- **WebSocket Updates**: Budget changes broadcast in real-time after reconciliation completes
- **Impact**: Users can now fully edit all document fields (project, unit, amounts, recipients, protocol info) with automatic budget tracking and reconciliation. Budget integrity is maintained even during errors through compensating transactions.

## October 14, 2025 - ΕΚΤΟΣ ΕΔΡΑΣ Employee Payments Integration
- **Issue**: ΕΚΤΟΣ ΕΔΡΑΣ documents were not saving employee payment IDs, and document cards couldn't display employee payment data
- **Solution**:
  - Added `employee_payments_id` column to `generated_documents` table schema in `shared/schema.ts`
  - Updated backend to conditionally save employee payment IDs for ΕΚΤΟΣ ΕΔΡΑΣ documents in `server/controllers/documentsController.ts`
  - Modified both document fetch routes (GET /api/documents and GET /api/documents/user) to:
    - Check for `employee_payments_id` array first
    - Fetch employee payment data with joined employee details from EmployeePayments table
    - Transform data to include ΕΚΤΟΣ ΕΔΡΑΣ-specific fields (month, days, daily_compensation, accommodation_expenses, kilometers_traveled, tickets_tolls_rental)
    - Fallback to beneficiary payments if no employee payments exist
  - Updated frontend `Recipient` interface in document cards to include ΕΚΤΟΣ ΕΔΡΑΣ fields
- **Impact**: ΕΚΤΟΣ ΕΔΡΑΣ documents now properly link to employee payments, and document cards can display employee-specific expense data

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