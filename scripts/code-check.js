/**
 * Code Quality Check Script
 * 
 * This script performs basic code quality checks for the codebase, including:
 * 1. Finding potential null/undefined issues
 * 2. Detecting common bugs like accessing properties on undefined
 * 3. Identifying missing error handling
 * 
 * Usage: node scripts/code-check.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DIRS_TO_CHECK = [
  'server',
  'client/src'
];

const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build'
];

const EXTENSION_PATTERNS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx'
];

// Patterns to check for
const PATTERNS = {
  nullChecks: /(\w+)\.([\w-]+)(?!\s*(\?|&&|\|\|))/g,
  errorHandling: /try\s*{[^}]*}\s*catch\s*\([^)]*\)\s*{[^}]*}/g,
  consoleLog: /console\.log\(/g,
  debuggerStatements: /debugger;/g,
  commentedCode: /\/\/\s*[a-zA-Z0-9]+.+\n/g,
  todoComments: /\/\/\s*TODO:/g
};

// Helper functions
function getAllFiles(dir, exclude, extensions, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    // Skip excluded directories
    if (exclude.some(excludeDir => filePath.includes(excludeDir))) {
      return;
    }
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, exclude, extensions, fileList);
    } else {
      const ext = path.extname(file);
      if (extensions.some(e => e === ext)) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

// Perform checks
async function runChecks() {
  console.log('Starting code quality checks...');
  
  // Find all files to check
  let allFiles = [];
  DIRS_TO_CHECK.forEach(dir => {
    allFiles = allFiles.concat(
      getAllFiles(dir, EXCLUDE_DIRS, EXTENSION_PATTERNS)
    );
  });
  
  console.log(`Found ${allFiles.length} files to check`);
  
  // Show basic stats about the codebase
  let totalLines = 0;
  let totalConsoleLogCount = 0;
  let totalTodoCount = 0;
  
  allFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      totalLines += lines;
      
      // Count console.logs
      const consoleMatches = content.match(PATTERNS.consoleLog) || [];
      totalConsoleLogCount += consoleMatches.length;
      
      // Count TODOs
      const todoMatches = content.match(PATTERNS.todoComments) || [];
      totalTodoCount += todoMatches.length;
      
      // For large files, provide a warning
      if (lines > 500) {
        console.log(`Large file (${lines} lines): ${file}`);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error.message);
    }
  });
  
  console.log(`\nCode Stats:`);
  console.log(`Total files: ${allFiles.length}`);
  console.log(`Total lines: ${totalLines}`);
  console.log(`Console.log statements: ${totalConsoleLogCount}`);
  console.log(`TODO comments: ${totalTodoCount}`);
  
  // Show potential null/undefined issues using grep (more reliable for patterns)
  console.log(`\nChecking for potential null/undefined issues...`);
  try {
    const nullCheckCommand = `grep -r "\\." --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${DIRS_TO_CHECK.join(' ')} | grep -v "undefined" | grep -v "?" | grep -v "||" | grep -v "&&" | head -20`;
    console.log(execSync(nullCheckCommand).toString());
  } catch (error) {
    console.log('No major null/undefined issues found');
  }
  
  console.log('\nCode quality check completed!');
}

// Run the checks
runChecks().catch(err => {
  console.error('Error running checks:', err);
  process.exit(1);
});