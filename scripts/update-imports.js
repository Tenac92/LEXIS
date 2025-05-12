/**
 * Update Imports Script
 * 
 * This script helps update import statements across the codebase
 * when utilities are moved or renamed.
 * 
 * Usage: node scripts/update-imports.js <search-pattern> <replacement-pattern> [path]
 * 
 * Example:
 * node scripts/update-imports.js "from 'logger'" "from './logger'" server/utils
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_PATH = path.join(__dirname, '..');
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
const searchPattern = process.argv[2];
const replacementPattern = process.argv[3];
const targetPath = process.argv[4] ? path.resolve(process.argv[4]) : DEFAULT_PATH;

if (!searchPattern || !replacementPattern) {
  console.error('Error: Search pattern and replacement pattern are required');
  console.log('Usage: node scripts/update-imports.js <search-pattern> <replacement-pattern> [path]');
  process.exit(1);
}

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
 * Update import statements in files
 */
function updateImports(files, searchPattern, replacementPattern) {
  let totalReplacements = 0;
  let modifiedFiles = 0;
  
  files.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check if the file contains the search pattern
      if (content.includes(searchPattern)) {
        // Create a backup if one doesn't exist
        const backupPath = `${filePath}.bak`;
        if (!fs.existsSync(backupPath)) {
          fs.writeFileSync(backupPath, content, 'utf8');
        }
        
        // Replace all occurrences of the search pattern
        const newContent = content.replace(new RegExp(searchPattern, 'g'), replacementPattern);
        
        // Count replacements
        const replacements = (content.match(new RegExp(searchPattern, 'g')) || []).length;
        totalReplacements += replacements;
        
        // Write the updated content to the file
        fs.writeFileSync(filePath, newContent, 'utf8');
        
        console.log(`- Modified: ${filePath} (${replacements} replacements)`);
        modifiedFiles++;
      }
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  });
  
  return { totalReplacements, modifiedFiles };
}

/**
 * Main function
 */
function main() {
  console.log(`Updating imports from "${searchPattern}" to "${replacementPattern}" in: ${targetPath}`);
  
  try {
    const files = getAllFiles(targetPath, IGNORE_PATTERNS, FILE_EXTENSIONS);
    console.log(`Found ${files.length} files to check`);
    
    const { totalReplacements, modifiedFiles } = updateImports(files, searchPattern, replacementPattern);
    
    console.log(`\nSummary:`);
    console.log(`- Total files scanned: ${files.length}`);
    console.log(`- Files modified: ${modifiedFiles}`);
    console.log(`- Total replacements: ${totalReplacements}`);
    
    if (modifiedFiles > 0) {
      console.log(`\nBackups of modified files were created with '.bak' extension`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();