# Overview

This project is a full-stack TypeScript document management system for the Greek Civil Protection agency. Its primary purpose is to streamline budget management, project tracking, and document generation processes. Key capabilities include real-time notifications, PDF generation, comprehensive budget monitoring with quarterly transitions, and efficient management of employees and beneficiaries within projects. The system aims to enhance operational efficiency and financial oversight for the agency.

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