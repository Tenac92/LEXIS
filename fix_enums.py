#!/usr/bin/env python3
import re

path = r'c:\Users\USEER\Documents\LEXIS\client\src\pages\projects\[mis]\ComprehensiveEditFixed.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find lines with corrupted decision_status
lines = content.split('\n')
new_lines = []
for line in lines:
    if 'decision_status:' in line and 'Ενεργή' not in line and 'Ανενεργή' not in line and 'Αναστολή' not in line:
        # This line has corrupted value
        line = '      decision_status: "Ενεργή",'
    elif 'change_type:' in line and 'Έγκριση' not in line and 'Τροποποίηση' not in line and 'Παράταση' not in line:
        # This line has corrupted value
        line = '      change_type: "Έγκριση",'
    new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print('Fixed!')
