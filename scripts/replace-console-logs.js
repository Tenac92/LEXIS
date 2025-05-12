/**
 * Replace Console.log Script
 * 
 * This script scans the codebase for console.log statements and 
 * replaces them with proper structured logging using the logger utility.
 * 
 * Usage: node scripts/replace-console-logs.js [path]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_PATH = path.join(__dirname, '..', 'server');
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /\.next/,
  /\.cache/
];
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Parse command line arguments
const targetPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_PATH;

/**
 * Get all files in directory recursively
 */
function getAllFiles(dir, exclude = [], extensions = [], fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    // Check if path should be excluded
    if (exclude.some(pattern => pattern.test(filePath))) {
      return;
    }

    if (stats.isDirectory()) {
      getAllFiles(filePath, exclude, extensions, fileList);
    } else {
      const ext = path.extname(file);
      if (extensions.length === 0 || extensions.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

/**
 * Extract module name from file path
 */
function getModuleName(filePath) {
  const filename = path.basename(filePath, path.extname(filePath));
  
  // Handle index files by using directory name
  if (filename === 'index') {
    const dirName = path.basename(path.dirname(filePath));
    return dirName.charAt(0).toUpperCase() + dirName.slice(1);
  }
  
  // Convert kebab/snake case to pascal case
  return filename
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Check if file already imports the logger
 */
function hasLoggerImport(content) {
  return /import\s+.*?createLogger.*?from\s+['"].*?\/logger['"]/.test(content) ||
         /import\s+.*?logger.*?from\s+['"].*?\/logger['"]/.test(content);
}

/**
 * Get the logger import path (relative to the file)
 */
function getLoggerImportPath(filePath) {
  const targetDir = path.dirname(filePath);
  const serverDir = path.resolve(__dirname, '..', 'server');
  
  // Calculate relative path to server directory
  const relativeToServer = path.relative(targetDir, serverDir);
  
  // If the file is in the server directory or a subdirectory
  if (filePath.includes(serverDir)) {
    const utilsDir = path.join(serverDir, 'utils');
    const relativeToUtils = path.relative(targetDir, utilsDir);
    return path.join(relativeToUtils, 'logger').replace(/\\/g, '/');
  }
  
  // For files outside server directory (e.g., in client)
  return path.join(relativeToServer, 'utils', 'logger').replace(/\\/g, '/');
}

/**
 * Replace console.log statements with logger
 */
function replaceConsoleLogs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const moduleName = getModuleName(filePath);
  let newContent = content;
  
  // Count console.log statements
  const consoleLogMatches = content.match(/console\.log\s*\(/g) || [];
  if (consoleLogMatches.length === 0) {
    return { 
      filePath, 
      replacements: 0,
      skipped: true 
    };
  }
  
  // Add logger import if needed
  if (!hasLoggerImport(content)) {
    const loggerImportPath = getLoggerImportPath(filePath);
    const importStatement = `import { createLogger } from '${loggerImportPath}';\n\nconst logger = createLogger('${moduleName}');\n`;
    
    // Find a good position to add the import
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const importEndIndex = content.indexOf('\n', lastImportIndex) + 1;
      newContent = content.slice(0, importEndIndex) + 
                   '\n' + importStatement + 
                   content.slice(importEndIndex);
    } else {
      // No imports found, add at the beginning
      newContent = importStatement + newContent;
    }
  }
  
  // Replace console.log with logger.info or logger.debug
  newContent = newContent.replace(/console\.log\s*\(/g, 'logger.debug(');
  
  // Replace console.warn with logger.warn
  newContent = newContent.replace(/console\.warn\s*\(/g, 'logger.warn(');
  
  // Replace console.error with logger.error
  newContent = newContent.replace(/console\.error\s*\(/g, 'logger.error(');
  
  // Write the file back
  fs.writeFileSync(filePath, newContent, 'utf8');
  
  return {
    filePath,
    replacements: consoleLogMatches.length,
    skipped: false
  };
}

/**
 * Main function
 */
function main() {
  console.log(`Scanning for console.log statements in: ${targetPath}`);
  
  try {
    const files = getAllFiles(targetPath, IGNORE_PATTERNS, FILE_EXTENSIONS);
    console.log(`Found ${files.length} files to check`);
    
    let totalReplacements = 0;
    let modifiedFiles = 0;
    
    files.forEach(filePath => {
      const result = replaceConsoleLogs(filePath);
      
      if (!result.skipped) {
        totalReplacements += result.replacements;
        modifiedFiles++;
        console.log(`- Modified: ${filePath} (${result.replacements} replacements)`);
      }
    });
    
    console.log(`\nSummary:`);
    console.log(`- Total files scanned: ${files.length}`);
    console.log(`- Files modified: ${modifiedFiles}`);
    console.log(`- Total console.log replacements: ${totalReplacements}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();