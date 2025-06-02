# Server Utils Refactoring

This directory has been reorganized for better maintainability and single responsibility principle.

## New File Structure

### Core Document Generation
- **document-generation.ts** - Main entry point for all document generation operations
- **document-utilities.ts** - Shared utilities for document formatting and creation
- **document-types.ts** - Type definitions for document-related interfaces
- **document-validator.ts** - Document validation logic
- **document-database.ts** - Database operations for documents

### Primary Document Formatters
- **primary-document-formatter.ts** - Generates main request documents
- **secondary-document-formatter.ts** - Generates detailed recipient lists

### Utilities
- **data-helpers.ts** - Safe data handling and common transformations
- **logger.ts** - Structured logging system

### Legacy (Backward Compatibility)
- **document-shared.ts** - Backward compatibility layer (use DocumentUtilities instead)
- **DocumentFormatter.ts** - Backward compatibility wrapper (use DocumentGeneration instead)
- **DocumentManager.ts** - Split into DocumentDatabase and DocumentGeneration
- **SafeDataHelpers.ts** - Consolidated into data-helpers.ts

## Migration Guide

### Old vs New Usage

#### Document Generation
```typescript
// Old
import { DocumentFormatter } from './DocumentFormatter';
const buffer = await DocumentFormatter.generateDocument(data);

// New
import { DocumentGeneration } from './document-generation';
const buffer = await DocumentGeneration.generatePrimaryDocument(data);
```

#### Data Helpers
```typescript
// Old
import { safeString } from './SafeDataHelpers';

// New
import { safeString } from './data-helpers';
```

#### Document Utilities
```typescript
// Old
import { DocumentShared } from './document-shared';

// New
import { DocumentUtilities } from './document-utilities';
```

#### Database Operations
```typescript
// Old
import { DocumentManager } from './DocumentManager';
const manager = new DocumentManager();

// New
import { DocumentDatabase } from './document-database';
const database = new DocumentDatabase();
```

## File Purposes

### document-generation.ts
- Main entry point for document generation
- Handles primary, secondary, and correction documents
- Maintains backward compatibility

### document-utilities.ts
- Shared formatting utilities
- Common document elements (headers, signatures, tables)
- Reusable paragraph and text creation functions

### document-database.ts
- All document-related database operations
- Document filtering and searching
- Status management and statistics

### data-helpers.ts
- Safe data handling functions
- Type conversion utilities
- Greek-specific formatting (dates, currency, AFM)

### document-validator.ts
- Document and recipient validation
- Business rule enforcement
- Data integrity checks

## Benefits of Refactoring

1. **Single Responsibility** - Each file has a clear, single purpose
2. **Better Organization** - Related functionality grouped together
3. **Easier Maintenance** - Changes isolated to specific concerns
4. **Backward Compatibility** - Existing code continues to work
5. **Clear Dependencies** - Import structure shows relationships
6. **Better Testing** - Smaller, focused modules easier to test