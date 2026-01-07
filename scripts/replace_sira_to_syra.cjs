#!/usr/bin/env node
/**
 * Comprehensive SYRA to SYRA replacement script
 * Case-preserving replacements: SYRA→SYRA, syra→syra, Syra→Syra
 * Also handles email domains: @syra.com → @syra.com.sa
 */

const fs = require('fs');
const path = require('path');

// Directories to exclude
const EXCLUDE_DIRS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '.cache',
];

// File extensions to process
const FILE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', 
  '.md', '.yaml', '.yml', '.cjs', '.mjs', '.py',
  '.env', '.env.example', '.env.local.example'
];

// Files to skip (binary or special cases)
const SKIP_FILES = [
  'package-lock.json', // Will be regenerated
  'yarn.lock', // Will be regenerated
];

let totalFiles = 0;
let modifiedFiles = 0;

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  if (!FILE_EXTENSIONS.includes(ext)) {
    return false;
  }

  const basename = path.basename(filePath);
  if (SKIP_FILES.includes(basename)) {
    return false;
  }

  // Skip excluded directories
  const parts = filePath.split(path.sep);
  for (const part of parts) {
    if (EXCLUDE_DIRS.includes(part)) {
      return false;
    }
  }

  return true;
}

function replaceInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Case-preserving replacements
    // Must do in order: SYRA first, then syra, then Syra
    content = content.replace(/\bSIRA\b/g, 'SYRA');
    content = content.replace(/\bsira\b/g, 'syra');
    content = content.replace(/\bSira\b/g, 'Syra');

    // Email domain replacements
    content = content.replace(/@syra\.com/g, '@syra.com.sa');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      modifiedFiles++;
      console.log(`✓ Modified: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(entry.name)) {
        processDirectory(fullPath);
      }
    } else if (entry.isFile()) {
      if (shouldProcessFile(fullPath)) {
        totalFiles++;
        replaceInFile(fullPath);
      }
    }
  }
}

// Main execution
const rootDir = path.resolve(__dirname, '..');
console.log(`Starting SYRA → SYRA replacement in: ${rootDir}`);
console.log('Excluding:', EXCLUDE_DIRS.join(', '));
console.log('---');

processDirectory(rootDir);

console.log('---');
console.log(`Total files processed: ${totalFiles}`);
console.log(`Files modified: ${modifiedFiles}`);
console.log('Replacement complete!');

