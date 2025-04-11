#!/bin/bash

# Create an exact copy with our changes
cp server/utils/DocumentFormatter.ts.bak server/utils/DocumentFormatter.ts

# Manually edit each file and add conditional logic

# First location - around line 1045-1046
LINE_NUM_1=1045
sed -i "${LINE_NUM_1}s/      const fullName =/      \/\/ Only add ΤΟΥ if fathername exists and is not empty\n      const fullName = recipient.fathername \&\& recipient.fathername.trim() !== \"\"/" server/utils/DocumentFormatter.ts
LINE_NUM_2=1046
sed -i "${LINE_NUM_2}s/        \`\${recipient.lastname} \${recipient.firstname} ΤΟΥ \${recipient.fathername}\`.trim();/        ? \`\${recipient.lastname} \${recipient.firstname} ΤΟΥ \${recipient.fathername}\`.trim()\n        : \`\${recipient.lastname} \${recipient.firstname}\`.trim();/" server/utils/DocumentFormatter.ts

# Second location - around line 1276-1277
LINE_NUM_3=1276
sed -i "${LINE_NUM_3}s/      const fullName =/      \/\/ Only add ΤΟΥ if fathername exists and is not empty\n      const fullName = recipient.fathername \&\& recipient.fathername.trim() !== \"\"/" server/utils/DocumentFormatter.ts
LINE_NUM_4=1277
sed -i "${LINE_NUM_4}s/        \`\${recipient.lastname} \${recipient.firstname} ΤΟΥ \${recipient.fathername}\`.trim();/        ? \`\${recipient.lastname} \${recipient.firstname} ΤΟΥ \${recipient.fathername}\`.trim()\n        : \`\${recipient.lastname} \${recipient.firstname}\`.trim();/" server/utils/DocumentFormatter.ts

echo "Fixed father's name handling in both locations"