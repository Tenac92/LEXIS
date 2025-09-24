# Overview

This is a full-stack project management and document generation application built for the Greek civil protection agency. The system handles project budgets, beneficiary payments, document generation, and administrative workflows with multi-unit access control. It features real-time budget notifications, quarterly budget transitions, and comprehensive document management with Word document generation capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend uses React with TypeScript, built on Vite for fast development and optimized builds. The UI framework is built with Tailwind CSS and shadcn/ui components for a professional government interface. The application uses Wouter for client-side routing and React Query (TanStack Query) for server state management.

Key architectural decisions:
- **Component Organization**: Pages are organized by feature (projects, documents, budget, admin) with shared components in the UI library
- **State Management**: React Query handles server state, React Context provides form state management
- **Authentication**: Session-based authentication with protected routes and role-based access control
- **Real-time Updates**: WebSocket integration for live budget notifications and document status updates

## Backend Architecture
The server follows an Express.js architecture with TypeScript, using a service-oriented design pattern. The application is structured with clear separation between routes, controllers, services, and data access layers.

Core architectural components:
- **Authentication System**: Session-based auth with role-based permissions and unit-based access control
- **Database Layer**: Supabase as the primary database with Drizzle ORM schema definitions for type safety
- **Document Generation**: Custom Word document generation using docx library with template-based approach
- **Real-time Communication**: WebSocket server for budget notifications and live updates
- **Scheduled Tasks**: Node-cron for automated quarterly budget transitions
- **Error Handling**: Comprehensive error recovery middleware with database connection management

## Data Storage Architecture
The system uses PostgreSQL through Supabase as the primary database, with a well-structured schema supporting:

- **User Management**: Multi-role users with unit-based access control
- **Project Management**: Complex project structure with budget tracking, history, and formulations
- **Document System**: Generated documents with attachment requirements and status tracking
- **Financial Tracking**: Budget allocations, spending tracking, and quarterly transitions
- **Audit Trail**: Comprehensive history tracking for all major operations

## Authentication and Authorization
Session-based authentication using express-session with memory store, supporting:
- **Role-based Access**: Admin, manager, and user roles with different permission levels
- **Unit-based Security**: Users restricted to their assigned organizational units
- **Session Management**: Automatic session cleanup and keep-alive mechanisms
- **Geographic Restrictions**: IP-based geo-blocking for Greek government security requirements

# External Dependencies

## Database Services
- **Supabase**: PostgreSQL database hosting with real-time features and authentication
- **Database URL**: Configured through environment variables with fallback connection handling

## Document Generation
- **docx Library**: Microsoft Word document generation with template support
- **JSZip**: Archive handling for document attachments and bulk operations

## Real-time Features
- **WebSocket (ws)**: Native WebSocket implementation for real-time budget notifications
- **Node-cron**: Scheduled task management for quarterly budget transitions

## File Handling
- **Multer**: Multipart form data handling for file uploads
- **XLSX**: Excel file processing for budget data imports

## Security and Monitoring
- **Helmet**: Security headers middleware
- **bcrypt**: Password hashing and authentication
- **GeoIP-lite**: Geographic IP restriction for government security
- **Rate Limiting**: Express-rate-limit for API protection

## Email Services
- **SendGrid**: Email delivery for notifications and administrative communications

## AI Integration
- **Anthropic SDK**: Claude AI integration for document processing and automation features

## Development Tools
- **Drizzle Kit**: Database migration and schema management
- **TypeScript**: Type safety across the full stack
- **Zod**: Runtime type validation and schema enforcement
- **ESBuild**: Fast JavaScript bundling for production builds