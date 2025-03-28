# Production Deployment Guide

This guide provides instructions for deploying the application to a production environment.

## Prerequisites

Before deploying to production, ensure you have:

1. A Supabase account and project set up
2. Access to the production server environment
3. Required environment variables

## Environment Variables

The following environment variables are required for production deployment:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SESSION_SECRET=your-secure-session-secret
COOKIE_DOMAIN=.sdegdaefk.gr
NODE_ENV=production
```

## Deployment Steps

### 1. Clone the Repository

```bash
git clone https://github.com/your-organization/your-repository.git
cd your-repository
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Application

```bash
npm run build
```

### 4. Configure Environment Variables

Create a `.env` file (or use environment configuration in your hosting platform) with the required variables listed above.

### 5. Test the Database Connection

Before starting the server, verify that you can connect to the Supabase database:

```bash
node check-supabase-connection.js
```

### 6. Start the Server

For production, you'll want to use a process manager like PM2:

```bash
npm install -g pm2
pm2 start server/index.js --name budget-app
```

## Monitoring and Maintenance

### Health Checks

Use the built-in health check endpoint to monitor the application:

```
GET /api/health
```

### Database Diagnostics

Regular database monitoring is essential. Use the provided diagnostic scripts:

```bash
node test-supabase-network.js  # Check network connectivity
node test-api-health.js        # Test API endpoints
```

### Authentication Maintenance

If user authentication issues occur, use the following tools to diagnose and fix:

```bash
node list-users.js     # List all users in the database
node fix-password.js   # Fix user passwords if needed
```

## Troubleshooting Common Issues

### 500 Errors in Greek

If you see 500 errors with Greek text, this may indicate:

1. Database connectivity issues
2. Authentication problems
3. Session management errors

First, check the application logs for specific error messages related to Supabase connections.

### Failed to Prune Sessions

This error has been addressed by migrating to an in-memory session store. However, if you see excessive memory usage, consider restarting the application.

### Invalid Email or Password

If users cannot log in, first verify the user exists in the database using `list-users.js` and then reset their password using `fix-password.js`.

### Cross-Domain Cookie Issues

If users are being logged out when navigating between subdomains, verify that the `COOKIE_DOMAIN` is set correctly to `.sdegdaefk.gr`.

## Backup and Recovery

### Database Backup

Supabase provides automatic backups. However, for critical data, you may want to implement additional backup procedures:

```bash
# Example script to export users data
node export-users-to-json.js > users-backup.json
```

### Emergency Recovery

If you need to restore the service quickly, consider the following steps:

1. Verify Supabase connectivity using diagnostic tools
2. Check for environment variable issues
3. Restart the application server
4. If necessary, restore from backups

## Security Considerations

1. Ensure `SUPABASE_KEY` uses the "service_role" key, but keep it secure
2. Regularly rotate the `SESSION_SECRET`
3. Enable HTTPS for all production traffic
4. Monitor for unusual authentication patterns

## Performance Optimization

For optimal performance in production:

1. Enable compression middleware
2. Implement proper caching strategies
3. Consider rate limiting on sensitive endpoints
4. Monitor memory usage of the session store

## Scaling Considerations

If you need to scale the application:

1. Consider moving to a distributed session store
2. Implement horizontal scaling with load balancing
3. Optimize database queries for heavy traffic
4. Leverage Supabase's Realtime features for live updates