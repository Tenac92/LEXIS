# Create an exact copy with our changes
cp server/utils/DocumentFormatter.ts.bak tmp/DocumentFormatter.modified.ts

# First location - Replace in the first createPaymentTable method (around line 1046)
sed -i '1045,1046s/      const fullName =\n        `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim();/      \/\/ Only add ΤΟΥ if fathername exists and is not empty\n      const fullName = recipient.fathername \&\& recipient.fathername.trim() !== ""\n        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()\n        : `${recipient.lastname} ${recipient.firstname}`.trim();/' tmp/DocumentFormatter.modified.ts

# Second location - Replace in the second createRecipientsTableWithAction method (around line 1277)
sed -i '1276,1277s/      const fullName =\n        `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim();/      \/\/ Only add ΤΟΥ if fathername exists and is not empty\n      const fullName = recipient.fathername \&\& recipient.fathername.trim() !== ""\n        ? `${recipient.lastname} ${recipient.firstname} ΤΟΥ ${recipient.fathername}`.trim()\n        : `${recipient.lastname} ${recipient.firstname}`.trim();/' tmp/DocumentFormatter.modified.ts