#!/bin/bash

# Original string patterns
PATTERN1='    recipients.forEach((recipient, index) => {
      const fullName =
        `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim();'

PATTERN2='    recipients.forEach((recipient, index) => {
      const fullName =
        `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim();'

# New string with conditional logic
REPLACEMENT='    recipients.forEach((recipient, index) => {
      // Only add ΤΟΥ if fathername exists and is not empty
      const fullName = recipient.fathername && recipient.fathername.trim() !== ""
        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()
        : `${recipient.lastname} ${recipient.firstname}`.trim();'

# Create a backup
cp server/utils/DocumentFormatter.ts tmp/DocumentFormatter.ts.before_fix

# Make replacements using line numbers to ensure precision
sed -i '1044,1046c\    recipients.forEach((recipient, index) => {\n      // Only add ΤΟΥ if fathername exists and is not empty\n      const fullName = recipient.fathername && recipient.fathername.trim() !== ""\n        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()\n        : `${recipient.lastname} ${recipient.firstname}`.trim();' server/utils/DocumentFormatter.ts

sed -i '1275,1277c\    recipients.forEach((recipient, index) => {\n      // Only add ΤΟΥ if fathername exists and is not empty\n      const fullName = recipient.fathername && recipient.fathername.trim() !== ""\n        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()\n        : `${recipient.lastname} ${recipient.firstname}`.trim();' server/utils/DocumentFormatter.ts

echo "Fixed father's name handling in both locations"
