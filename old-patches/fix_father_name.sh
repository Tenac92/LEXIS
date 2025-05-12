#!/bin/bash

# Create a backup if it doesn't exist already
if [ ! -f "server/utils/DocumentFormatter.ts.bak" ]; then
    cp server/utils/DocumentFormatter.ts server/utils/DocumentFormatter.ts.bak
    echo "Created backup at server/utils/DocumentFormatter.ts.bak"
fi

# Restore from backup to ensure a clean state
cp server/utils/DocumentFormatter.ts.bak server/utils/DocumentFormatter.ts

# First location - Line 1046
# Replace line 1045 and 1046 with the conditional logic
sed -i '1045,1046s/      const fullName =\n        `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim();/      const fullName = recipient.fathername && recipient.fathername.trim() !== "" \n        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()\n        : `${recipient.lastname} ${recipient.firstname}`.trim();/' server/utils/DocumentFormatter.ts

# Second location - Line 1277
# Replace line 1276 and 1277 with the conditional logic
sed -i '1276,1277s/      const fullName =\n        `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim();/      const fullName = recipient.fathername && recipient.fathername.trim() !== "" \n        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()\n        : `${recipient.lastname} ${recipient.firstname}`.trim();/' server/utils/DocumentFormatter.ts

echo "Fixed father's name handling in both locations"