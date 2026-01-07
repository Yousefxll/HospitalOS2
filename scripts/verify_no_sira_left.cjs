#!/usr/bin/env node
/**
 * Verification Script: Ensure No SIRA References Remain
 * 
 * Scans all files and fails if any SIRA/sira/Sira references are found
 * (except in binary files or excluded directories)
 * 
 * Usage:
 *   node scripts/verify_no_sira_left.cjs
 * 
 * Exit code: 0 if no SIRA references found, 1 if any are found
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
  'coverage',
  '.nyc_output',
];

// File extensions to check
const FILE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', 
  '.md', '.yaml', '.yml', '.cjs', '.mjs', '.py',
  '.env', '.env.example', '.env.local.example',
  '.txt', '.config.js', '.config.ts',
];

// Files to skip (binary or special cases)
const SKIP_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

// Files/directories with intentional SIRA references (migration scripts, verification script itself)
const INTENTIONAL_SIRA_FILES = [
  'scripts/migrations/017_migrate_sira_to_syra_roles.cjs',
  'scripts/migrations/018_migrate_platform_db_sira_to_syra.cjs',
  'scripts/verify_no_sira_left.cjs',
];

// Patterns to search for (case-sensitive)
const PATTERNS = [
  /\bSIRA\b/g,
  /\bsira\b/g,
  /\bSira\b/g,
];

const PATTERN_NAMES = ['SIRA', 'sira', 'Sira'];

let totalFiles = 0;
let filesWithMatches = 0;
const matches = [];

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

  // Skip files with intentional SIRA references (migration scripts, etc.)
  const relativePath = path.relative(rootDir, filePath);
  if (INTENTIONAL_SIRA_FILES.some(intentional => relativePath.includes(intentional))) {
    return false;
  }

  return true;
}

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let fileHasMatch = false;
    const fileMatches = [];

    for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
      const line = lines[lineNum - 1];
      
      for (let i = 0; i < PATTERNS.length; i++) {
        const pattern = PATTERNS[i];
        const patternName = PATTERN_NAMES[i];
        
        // Reset regex lastIndex for global regex
        pattern.lastIndex = 0;
        
        if (pattern.test(line)) {
          fileHasMatch = true;
          fileMatches.push({
            line: lineNum,
            pattern: patternName,
            content: line.trim(),
          });
        }
      }
    }

    if (fileHasMatch) {
      filesWithMatches++;
      matches.push({
        file: filePath,
        matches: fileMatches,
      });
    }

    return fileHasMatch;
  } catch (error) {
    // Skip binary files or files that can't be read as text
    if (error.code === 'EISDIR' || error.code === 'ENOENT') {
      return false;
    }
    // For other errors, log but don't fail
    console.error(`⚠️  Warning: Could not read ${filePath}: ${error.message}`);
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
        checkFile(fullPath);
      }
    }
  }
}

// Main execution
const rootDir = path.resolve(__dirname, '..');
console.log(`🔍 Scanning for SIRA/sira/Sira references in: ${rootDir}`);
console.log('Excluding:', EXCLUDE_DIRS.join(', '));
console.log('---');

processDirectory(rootDir);

console.log('---');
console.log(`📊 Files scanned: ${totalFiles}`);
console.log(`❌ Files with matches: ${filesWithMatches}`);

if (matches.length > 0) {
  console.log('\n❌ VERIFICATION FAILED: Found SIRA references in the following files:\n');
  
  for (const match of matches) {
    console.log(`📄 ${match.file}`);
    for (const m of match.matches) {
      console.log(`   Line ${m.line} (pattern: ${m.pattern}): ${m.content.substring(0, 100)}`);
    }
    console.log('');
  }

  console.log(`\n❌ Total: ${filesWithMatches} file(s) with SIRA references`);
  console.log('\n💡 Please review and update these files to complete the rebrand.');
  process.exit(1);
} else {
  console.log('\n✅ VERIFICATION PASSED: No SIRA references found!');
  console.log('🎉 Rebrand complete - all references have been updated to SYRA.');
  process.exit(0);
}

