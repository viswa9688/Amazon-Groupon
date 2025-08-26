# Overview

OneAnt is a full-stack group purchasing marketplace application that enables users to collaborate and buy products together to achieve better prices through bulk discounts. The platform connects buyers seeking discounted prices with sellers offering tiered pricing based on quantity. Users can join active group purchases, track progress toward pricing goals, and benefit from collective buying power.

The application features a modern React frontend built with TypeScript and shadcn/ui components, paired with an Express.js backend using PostgreSQL for data persistence. The architecture supports both individual buyers and sellers, with authentication provided through Replit's OAuth integration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite for build tooling and development server
- **Routing**: Wouter for client-side routing with protected routes based on authentication state
- **UI Components**: shadcn/ui component library built on Radix UI primitives with Tailwind CSS styling
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Styling**: Tailwind CSS with custom CSS variables for theming, using the "new-york" style variant

## Backend Architecture
- **Framework**: Express.js server with TypeScript, using ESM modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Replit OAuth integration with session-based authentication using express-session
- **API Design**: RESTful endpoints with proper error handling and request logging middleware
- **Database Connection**: Neon serverless PostgreSQL with connection pooling

## Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless platform
- **ORM**: Drizzle ORM with TypeScript schema definitions providing type safety
- **Session Storage**: PostgreSQL-backed session store using connect-pg-simple
- **Schema Management**: Drizzle Kit for database migrations and schema synchronization

## Authentication and Authorization
- **Provider**: Replit OAuth using OpenID Connect protocol
- **Session Management**: Server-side sessions stored in PostgreSQL with configurable TTL
- **Authorization**: Role-based access with `isAuthenticated` middleware for protected routes
- **User Management**: Automatic user creation/update on successful authentication

## External Dependencies
- **Database**: Neon serverless PostgreSQL for production data storage
- **Authentication**: Replit OAuth service for user authentication and profile management
- **CDN**: Unsplash for placeholder product images
- **Fonts**: Google Fonts integration (Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter)
- **Development**: Replit-specific development tools and error overlay for enhanced development experience

The application uses a monorepo structure with shared TypeScript schemas between frontend and backend, ensuring type consistency across the full stack. The build process separates client and server bundles, with the client building to a static distribution and the server bundling with esbuild for Node.js deployment.