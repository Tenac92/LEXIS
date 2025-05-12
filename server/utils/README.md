# Document Formatter

The DocumentFormatter.ts file is a critical part of the system responsible for generating official documents based on templates and data from the database.

## Code Organization

This utility file should be broken down into smaller, more focused components:

- **DocumentFormatter.ts**: Main class with core formatting logic
- **TableFormatter.ts**: Extracted table formatting logic
- **HeaderFormatter.ts**: Extracted document header formatting
- **RecipientFormatter.ts**: Logic for formatting recipient data
- **DocumentHelpers.ts**: Shared helper functions

## Safe Handling of Data

All functions should handle null/undefined values safely. In particular:

- Recipient properties (firstname, lastname, fathername, afm)
- Amount calculations
- Date formatting
- String operations

Always use safe accessors like `value || defaultValue` or `value?.property` to avoid null reference exceptions.

## Testing

Unit tests should be created for these critical formatters, especially focusing on edge cases:
- Missing recipient data
- Empty arrays
- Special character handling
- Proper insertion of Greek text