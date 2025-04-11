#!/bin/bash
# Create a backup first
cp server/utils/DocumentFormatter.ts tmp/DocumentFormatter.backup1.ts

# Replace the first occurrence at line 1045-1046
sed -i '1045,1046c\      // Only add ΤΟΥ if fathername exists and is not empty\n      const fullName = recipient.fathername && recipient.fathername.trim() !== ""\n        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()\n        : `${recipient.lastname} ${recipient.firstname}`.trim();' server/utils/DocumentFormatter.ts

echo "Applied first patch"
