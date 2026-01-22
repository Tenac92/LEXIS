# Overview

This project is a full-stack TypeScript document management system designed for the Greek Civil Protection agency. Its main goal is to improve budget management, project tracking, and document generation. Key features include real-time notifications, PDF generation, detailed budget monitoring with quarterly transitions, and efficient management of employees and beneficiaries within projects. The system aims to boost operational efficiency and financial oversight for the agency.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite.
- **UI Components**: Radix UI primitives integrated with shadcn/ui.
- **Styling**: Tailwind CSS with custom CSS variables.
- **State Management**: TanStack Query for server state.
- **Routing**: Wouter for lightweight client-side routing.
- **Forms**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Accordion-based UI for complex sections (e.g., decisions, formulations) with batch operations (select all, duplicate, delete) and color-coded elements for status and type identification. Consistent display of document statuses across the application using defined color schemes (e.g., gray for draft, green for approved).

## Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **Database ORM**: Direct Supabase client calls.
- **Session Management**: Express-session.
- **Authentication**: Custom JWT-like session with role-based access control.
- **WebSocket**: Native WebSocket server for real-time updates.
- **File Processing**: XLSX for budget uploads and PDF generation.
- **Feature Specifications**:
    - Comprehensive budget history tracking with NA853 code filtering and accurate categorization of spending and refunds.
    - Robust quarter transition logic that correctly calculates leftover budget based on quarterly spending.
    - AFM search optimization through database indexing and efficient decryption.
    - Integration of a "Summary Description" field for projects.
    - Proper loading and persistence of EPA financial records.
    - Numeric field type alignment across frontend and backend to prevent validation errors.
    - Critical routing bug fixes to ensure correct API endpoint handling.
    - **Budget History XLSX Export** (November 2025): Comprehensive Excel export for managers and admins via `/api/budget/history/export` with 6 analytical worksheets:
        1. Αναλυτικό Ιστορικό (Detailed History) - Full change log with geographic hierarchy (Περιφέρεια, Π.Ε., Δήμος)
        2. Σύνοψη Έργων (Project Summary) - Per-project aggregation with absorption rates
        3. Ανά Περιφέρεια (Regional Summary) - Geographic breakdown of spending
        4. Ανά Τύπο Αλλαγής (Change Type Analysis) - Breakdown by change category
        5. Μηνιαία Τάση (Monthly Trend) - Temporal spending patterns
        6. Δραστηριότητα Χρηστών (User Activity) - Activity per user
        - Enforces unit-based access control (managers see only their units' data)
        - Applies same filters as UI (NA853, expenditure type, date range, creator, change type)
        - European number formatting and Greek labels throughout

## Data Storage Solutions
- **Primary Database**: Supabase (PostgreSQL) with Row Level Security.
- **Schema Management**: Drizzle schema definitions.
- **Data Access**: Direct Supabase client calls.

## Authentication and Authorization
- **Authentication**: Session-based with Supabase user verification.
- **Authorization**: Role-based (Admin, Manager, User) and unit-based restrictions.
- **Security**: CORS configuration for specific domains and Geo-IP restrictions to Greece.
- **GeoIP Security Hardening** (November 2025):
    - Removed spoofable HTTP header checks (Origin, Referer, Host) that allowed bypass.
    - Uses RIGHTMOST non-private IP from X-Forwarded-For to prevent header spoofing attacks.
    - Session-based geo-verification: Users who login from Greece get `geoVerified` flag allowing access from any location.
    - Fail-closed behavior: If GeoIP lookup fails, access is denied rather than allowed.
    - WebSocket connections also enforce GeoIP restrictions.
    - Only trusts X-Forwarded-For when socket connection is from private IP (trusted proxy like Render).

## Key Design Patterns
- **Service Layer**: Dedicated services for core functionalities (budget, notifications, scheduling).
- **Controller Pattern**: Express controllers for API routes.
- **Middleware Chain**: Comprehensive handling for authentication, CORS, security, and errors.
- **Real-time Updates**: WebSocket broadcasting for dynamic data changes.

## Performance Optimizations
- **Query Optimization**: Direct Supabase queries and database indexing for critical fields (e.g., AFM hashes).
- **Connection Management**: Supabase-managed connection pooling.
- **Caching**: Session-based caching and client-side query caching (e.g., TanStack Query).
- **Bundle Optimization**: Vite-based code splitting.
- **AFM Search**: Reduced batch sizes, early exit logic during decryption, and optimized column selection.
- **Background AFM Prefetch**: On login and app load, the system prefetches and caches all decrypted AFMs in the background. This makes autocomplete searches instant when creating documents, as data is already in memory. The cache persists for 10 minutes server-side and uses React Query client-side caching (5 min stale, 10 min gc). Falls back to regular search if cache is not available.
- **Reference Data Cache**: Static reference data (Monada units, event_types, expenditure_types) is cached in memory with 10-minute TTL. Preloaded on server startup, reducing repeated database queries for unchanging reference data.
- **Project Loading Optimization**: The `/api/projects-working` endpoint now queries only unit-specific project IDs first, then fetches those specific projects. Combined with cached reference data, this significantly reduces database load. The `listProjects` function similarly fetches only project_index rows for the current page's projects.
- **Subprojects Loading Optimization**: Uses two-step query approach - first fetching EPA version IDs, then querying subprojects with `.in()` instead of expensive inner joins. Financial data is transformed from `subproject_financials` array to `yearly_budgets` object for UI compatibility.

# External Dependencies

## Database Services
- **Supabase**: Primary PostgreSQL database, providing real-time capabilities.

## Third-party APIs and Services
- **SendGrid**: Email notification service.
- **Anthropic AI**: AI integration for document assistance.
- **MaxMind GeoIP**: Geographic IP restriction service.

## Development and Build Tools
- **Vite**: Frontend build tool.
- **TypeScript**: Language and type-checking.
- **Drizzle Kit**: Database schema toolkit.
- **ESBuild**: Server-side bundling.

## Frontend Libraries
- **React Query**: Data fetching and state management.
- **Radix UI**: Unstyled, accessible UI primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Wouter**: Client-side router.
- **React Hook Form**: Form management.

## Backend Libraries
- **Express.js**: Web framework.
- **Multer**: File upload handling.
- **XLSX**: Excel file processing.
- **Helmet**: Security headers.
- **Node-cron**: Scheduled tasks.
- **BCrypt**: Password hashing.