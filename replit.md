# Overview

This project is a full-stack TypeScript document management system for the Greek Civil Protection agency. Its primary purpose is to streamline budget management, project tracking, and document generation processes. Key capabilities include real-time notifications, PDF generation, comprehensive budget monitoring with quarterly transitions, and efficient management of employees and beneficiaries within projects. The system aims to enhance operational efficiency and financial oversight for the agency.

# Recent Changes

## 2025-10-30: EPA Financials Database Integration Fix
Fixed critical data persistence issue where EPA budget version financial records (Οικονομικά ΕΠΑ) weren't being loaded from the epa_financials table. Changes:
- Added fetch logic in /complete endpoint to load EPA financials from epa_financials table using epa_version_id
- Group financials by epa_version_id and attach to each EPA budget version object
- Verified cascade delete behavior on foreign key (epa_financials.epa_version_id → project_budget_versions.id)
- Confirmed processBudgetVersions function correctly inserts financials into epa_financials table
- Data flow now complete: Database (epa_financials) → API (budget_versions.epa[].financials) → Frontend form
- Server logs confirm EPA financials are being fetched and loaded successfully

## 2025-10-30: Decisions Accordion UI with Batch Operations
Enhanced the project edit form's decisions section with accordion-based UI and batch operations, matching the patterns used for formulations and locations. Changes:
- Implemented accordion UI for decisions with expandable/collapsible items
- Added batch selection and operations: Select All, Deselect All, Duplicate Selected, Delete Selected
- Created preview cards for decision accordion headers showing: protocol number, decision type, budget, FEK info, ADA, and implementing agencies count
- Added color-coded left borders based on decision type: Έγκριση (blue), Τροποποίηση (orange), Παράταση (gray)
- Integrated checkboxes for batch selection in each accordion trigger
- Added status badge "Εξαιρείται" when a decision is excluded (included = false)
- All form fields preserved in accordion content with proper validation
- Consistent UI/UX pattern across all three sections (formulations, locations, decisions)

## 2025-10-30: Numeric Field Type Alignment
Fixed critical type mismatch in project edit form where database numeric fields (boundary_budget, total_public_expense, eligible_public_expense) were being validated as strings, causing save failures. Changes:
- Updated form schema to use `z.number().optional()` for PDE boundary_budget and EPA financial fields
- Updated input components to format numbers for display (European format) and parse string input to numbers
- Removed duplicate function definitions for parseEuropeanNumber and formatNumberWhileTyping
- Updated data loading logic to preserve numeric values from database without string conversion
- Updated form submission logic to extract latest boundary_budget from PDE budget versions (instead of the removed project_budget field)
- All numeric data now flows correctly: Database (numbers) → Form (numbers) → Validation (numbers) → Submission (numbers)

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

## Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **Database ORM**: Direct Supabase client calls.
- **Session Management**: Express-session.
- **Authentication**: Custom JWT-like session with role-based access control.
- **WebSocket**: Native WebSocket server for real-time updates.
- **File Processing**: XLSX for budget uploads and PDF generation.

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
- **Query Optimization**: Direct Supabase queries.
- **Connection Management**: Supabase-managed connection pooling.
- **Caching**: Session-based caching.
- **Bundle Optimization**: Vite-based code splitting.

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

## Integration Requirements
- **Greek Domain Integration**: Specific CORS and middleware for sdegdaefk.gr.
- **European Number Formatting**: Custom parsers for Greek number formats.
- **Real-time Communication**: WebSocket server for live updates.