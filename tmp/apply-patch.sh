#!/bin/bash

# This script applies our specific patch to both occurrences of the fullName variable declaration
# It uses line numbers to ensure precise replacement

# Copy the original backup file to our working file
cp tmp/DocumentFormatter.original.ts tmp/DocumentFormatter.patched.ts

# Apply the patch to the first occurrence (around line 1045-1046)
sed -i '1045,1046c\      // Only add ΤΟΥ if fathername exists and is not empty\n      const fullName = recipient.fathername \&\& recipient.fathername.trim() !== ""\n        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()\n        : `${recipient.lastname} ${recipient.firstname}`.trim();' tmp/DocumentFormatter.patched.ts

# Apply the patch to the second occurrence (around line 1276-1277)
sed -i '1276,1277c\      // Only add ΤΟΥ if fathername exists and is not empty\n      const fullName = recipient.fathername \&\& recipient.fathername.trim() !== ""\n        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()\n        : `${recipient.lastname} ${recipient.firstname}`.trim();' tmp/DocumentFormatter.patched.ts

# Display a diff to see what changed
diff -u tmp/DocumentFormatter.original.ts tmp/DocumentFormatter.patched.ts | grep -A6 -B2 "ΤΟΥ"

# If everything looks good, replace the actual file
if [ $? -eq 0 ]; then
  cp tmp/DocumentFormatter.patched.ts server/utils/DocumentFormatter.ts
  echo "Successfully patched server/utils/DocumentFormatter.ts"
else
  echo "Failed to create diff, something went wrong"
fi