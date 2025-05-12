/**
 * Split Large File Script
 * 
 * This script analyzes a TypeScript file and suggests how to split it
 * into smaller files based on function and class groupings.
 * 
 * Usage: node scripts/split-large-file.js <file-path>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const filePath = process.argv[2];

if (!filePath) {
  console.error('Error: File path is required');
  console.log('Usage: node scripts/split-large-file.js <file-path>');
  process.exit(1);
}

const resolvedPath = path.resolve(filePath);

if (!fs.existsSync(resolvedPath)) {
  console.error(`Error: File not found: ${resolvedPath}`);
  process.exit(1);
}

// Function to extract functions and classes from file
function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Count total lines
    const totalLines = lines.length;
    
    // Extract imports
    const imports = [];
    const importRegex = /^import\s+.+\s+from\s+['"].+['"];?$/;
    lines.forEach(line => {
      if (importRegex.test(line.trim())) {
        imports.push(line.trim());
      }
    });
    
    // Extract functions
    const functions = [];
    const functionRegex = /^(export\s+)?(async\s+)?function\s+(\w+)/;
    const arrowFunctionRegex = /^(export\s+)?const\s+(\w+)\s+=\s+(async\s+)?\(/;
    
    let currentFunction = null;
    let currentFunctionLines = [];
    let bracketCount = 0;
    let inFunction = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const functionMatch = line.match(functionRegex);
      const arrowMatch = line.match(arrowFunctionRegex);
      
      // Check for function start
      if (!inFunction && (functionMatch || arrowMatch)) {
        const name = functionMatch ? functionMatch[3] : arrowMatch[2];
        currentFunction = {
          name,
          start: i,
          isExported: !!(functionMatch ? functionMatch[1] : arrowMatch[1]),
          isAsync: !!(functionMatch ? functionMatch[2] : arrowMatch[3]),
          content: [],
        };
        inFunction = true;
        bracketCount = 0;
      }
      
      // Count brackets to determine function end
      if (inFunction) {
        currentFunctionLines.push(lines[i]);
        
        // Count opening and closing brackets
        const openBrackets = (line.match(/\{/g) || []).length;
        const closeBrackets = (line.match(/\}/g) || []).length;
        bracketCount += openBrackets - closeBrackets;
        
        // If bracket count is 0 and we had at least one opening bracket, function is complete
        if (bracketCount <= 0 && currentFunctionLines.length > 1) {
          currentFunction.end = i;
          currentFunction.lineCount = currentFunction.end - currentFunction.start + 1;
          currentFunction.content = currentFunctionLines.join('\n');
          functions.push(currentFunction);
          
          inFunction = false;
          currentFunctionLines = [];
        }
      }
    }
    
    // Extract classes
    const classes = [];
    const classRegex = /^(export\s+)?class\s+(\w+)/;
    
    let currentClass = null;
    let currentClassLines = [];
    bracketCount = 0;
    let inClass = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const classMatch = line.match(classRegex);
      
      // Check for class start
      if (!inClass && classMatch) {
        const name = classMatch[2];
        currentClass = {
          name,
          start: i,
          isExported: !!classMatch[1],
          content: [],
          methods: [],
        };
        inClass = true;
        bracketCount = 0;
      }
      
      // Count brackets to determine class end
      if (inClass) {
        currentClassLines.push(lines[i]);
        
        // Look for methods within the class
        const methodRegex = /\s*(private|public|protected)?\s*(async\s+)?(\w+)\s*\(/;
        const methodMatch = line.match(methodRegex);
        
        if (methodMatch && bracketCount > 0) {
          currentClass.methods.push(methodMatch[3]);
        }
        
        // Count opening and closing brackets
        const openBrackets = (line.match(/\{/g) || []).length;
        const closeBrackets = (line.match(/\}/g) || []).length;
        bracketCount += openBrackets - closeBrackets;
        
        // If bracket count is 0 and we had at least one opening bracket, class is complete
        if (bracketCount <= 0 && currentClassLines.length > 1) {
          currentClass.end = i;
          currentClass.lineCount = currentClass.end - currentClass.start + 1;
          currentClass.content = currentClassLines.join('\n');
          classes.push(currentClass);
          
          inClass = false;
          currentClassLines = [];
        }
      }
    }
    
    // Extract interfaces and types
    const interfaces = [];
    const interfaceRegex = /^(export\s+)?(interface|type)\s+(\w+)/;
    
    let currentInterface = null;
    let currentInterfaceLines = [];
    bracketCount = 0;
    let inInterface = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const interfaceMatch = line.match(interfaceRegex);
      
      // Check for interface start
      if (!inInterface && interfaceMatch) {
        const name = interfaceMatch[3];
        const kind = interfaceMatch[2];
        currentInterface = {
          name,
          kind,
          start: i,
          isExported: !!interfaceMatch[1],
          content: [],
        };
        inInterface = true;
        bracketCount = 0;
      }
      
      // Count brackets to determine interface end
      if (inInterface) {
        currentInterfaceLines.push(lines[i]);
        
        // Count opening and closing brackets
        const openBrackets = (line.match(/\{/g) || []).length;
        const closeBrackets = (line.match(/\}/g) || []).length;
        bracketCount += openBrackets - closeBrackets;
        
        // Type definitions might end with just a semicolon
        const typeEndsWithSemicolon = currentInterface.kind === 'type' && line.endsWith(';');
        
        // If bracket count is 0 and we had at least one opening bracket, interface is complete
        if ((bracketCount <= 0 && currentInterfaceLines.length > 1) || typeEndsWithSemicolon) {
          currentInterface.end = i;
          currentInterface.lineCount = currentInterface.end - currentInterface.start + 1;
          currentInterface.content = currentInterfaceLines.join('\n');
          interfaces.push(currentInterface);
          
          inInterface = false;
          currentInterfaceLines = [];
        }
      }
    }
    
    return {
      totalLines,
      imports,
      functions,
      classes,
      interfaces,
    };
  } catch (error) {
    console.error('Error reading file:', error);
    process.exit(1);
  }
}

// Function to suggest file splitting based on analysis
function suggestFileSplitting(analysis) {
  const { totalLines, functions, classes, interfaces } = analysis;
  
  console.log(`\nAnalysis of file: ${resolvedPath}`);
  console.log(`Total lines: ${totalLines}`);
  console.log(`Found ${functions.length} functions, ${classes.length} classes, and ${interfaces.length} interfaces/types`);
  
  // Group related functions/classes by name
  const groupedItems = {};
  
  // Group interfaces by name
  interfaces.forEach(item => {
    const name = item.name;
    const keywords = name.split(/(?=[A-Z])/); // Split on capital letters
    
    keywords.forEach(keyword => {
      if (keyword.length > 2) { // Ignore short keywords
        const normalizedKeyword = keyword.toLowerCase();
        if (!groupedItems[normalizedKeyword]) {
          groupedItems[normalizedKeyword] = [];
        }
        groupedItems[normalizedKeyword].push({
          type: 'interface',
          name: item.name,
          lines: item.lineCount,
        });
      }
    });
  });
  
  // Group functions by name
  functions.forEach(item => {
    const name = item.name;
    const keywords = name.split(/(?=[A-Z])/); // Split on capital letters
    
    keywords.forEach(keyword => {
      if (keyword.length > 2) { // Ignore short keywords
        const normalizedKeyword = keyword.toLowerCase();
        if (!groupedItems[normalizedKeyword]) {
          groupedItems[normalizedKeyword] = [];
        }
        groupedItems[normalizedKeyword].push({
          type: 'function',
          name: item.name,
          lines: item.lineCount,
        });
      }
    });
  });
  
  // Group classes by name
  classes.forEach(item => {
    const name = item.name;
    const keywords = name.split(/(?=[A-Z])/); // Split on capital letters
    
    keywords.forEach(keyword => {
      if (keyword.length > 2) { // Ignore short keywords
        const normalizedKeyword = keyword.toLowerCase();
        if (!groupedItems[normalizedKeyword]) {
          groupedItems[normalizedKeyword] = [];
        }
        groupedItems[normalizedKeyword].push({
          type: 'class',
          name: item.name,
          lines: item.lineCount,
        });
      }
    });
  });
  
  // Sort groups by number of items
  const sortedGroups = Object.entries(groupedItems)
    .filter(([_, items]) => items.length > 1) // Only consider groups with more than 1 item
    .sort((a, b) => b[1].length - a[1].length);
  
  console.log('\nSuggested file groupings:');
  
  sortedGroups.forEach(([keyword, items]) => {
    const totalLinesInGroup = items.reduce((sum, item) => sum + item.lines, 0);
    console.log(`\n${keyword}.ts (${items.length} items, ~${totalLinesInGroup} lines):`);
    
    // Group by type for better organization
    const byType = {
      interface: items.filter(i => i.type === 'interface'),
      function: items.filter(i => i.type === 'function'),
      class: items.filter(i => i.type === 'class'),
    };
    
    Object.entries(byType).forEach(([type, typeItems]) => {
      if (typeItems.length > 0) {
        console.log(`  ${type}s:`);
        typeItems.forEach(item => {
          console.log(`    - ${item.name} (${item.lines} lines)`);
        });
      }
    });
  });
  
  // List large standalone items
  console.log('\nLarge standalone items that could be in their own files:');
  
  // List large functions (> 100 lines)
  const largeFunctions = functions.filter(f => f.lineCount > 100);
  if (largeFunctions.length > 0) {
    console.log('\n  Large functions:');
    largeFunctions.forEach(func => {
      console.log(`    - ${func.name} (${func.lineCount} lines)`);
    });
  }
  
  // List large classes (> 200 lines)
  const largeClasses = classes.filter(c => c.lineCount > 200);
  if (largeClasses.length > 0) {
    console.log('\n  Large classes:');
    largeClasses.forEach(cls => {
      console.log(`    - ${cls.name} (${cls.lineCount} lines)`);
      
      // Show methods if available
      if (cls.methods && cls.methods.length > 0) {
        console.log('      Methods:');
        cls.methods.slice(0, 5).forEach(method => {
          console.log(`        - ${method}`);
        });
        if (cls.methods.length > 5) {
          console.log(`        - ... and ${cls.methods.length - 5} more methods`);
        }
      }
    });
  }
  
  // Propose a splitting strategy
  console.log('\nProposed file splitting strategy:');
  
  // Create a list of suggested files
  const suggestedFiles = [];
  
  // Add top groups as separate files
  sortedGroups.slice(0, 3).forEach(([keyword, items]) => {
    const totalLinesInGroup = items.reduce((sum, item) => sum + item.lines, 0);
    if (totalLinesInGroup > 100) { // Only consider substantial groups
      suggestedFiles.push({
        name: `${keyword}.ts`,
        description: `Group of ${items.length} related items (${totalLinesInGroup} lines)`,
        importance: 'high',
      });
    }
  });
  
  // Add large standalone items
  largeFunctions.forEach(func => {
    suggestedFiles.push({
      name: `${func.name}.ts`,
      description: `Large function (${func.lineCount} lines)`,
      importance: 'medium',
    });
  });
  
  largeClasses.forEach(cls => {
    suggestedFiles.push({
      name: `${cls.name}.ts`,
      description: `Large class with ${cls.methods.length} methods (${cls.lineCount} lines)`,
      importance: 'high',
    });
  });
  
  // Sort suggested files by importance
  suggestedFiles.sort((a, b) => {
    const importanceScore = { high: 3, medium: 2, low: 1 };
    return importanceScore[b.importance] - importanceScore[a.importance];
  });
  
  suggestedFiles.forEach(file => {
    console.log(`  - ${file.name}: ${file.description}`);
  });
  
  console.log('\nRecommended next steps:');
  console.log('1. Create common utility files for shared functionality');
  console.log('2. Extract large classes into their own files first');
  console.log('3. Group related functions by domain/feature');
  console.log('4. Update imports across the codebase as you refactor');
}

// Run analysis
const analysis = analyzeFile(resolvedPath);
suggestFileSplitting(analysis);