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

## Data Storage Solutions
- **Primary Database**: Supabase (PostgreSQL) with Row Level Security.
- **Schema Management**: Drizzle schema definitions.
- **Data Access**: Direct Supabase client calls.

## Authentication and Authorization
- **Authentication**: Session-based with Supabase user verification.
- **Authorization**: Role-based (Admin, Manager, User) and unit-based restrictions.
- **Security**: CORS configuration for specific domains and Geo-IP restrictions to Greece.

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