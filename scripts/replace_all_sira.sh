#!/bin/bash
# Comprehensive SIRA to SYRA replacement script
# Case-preserving replacements

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.md" -o -name "*.yaml" -o -name "*.yml" -o -name "*.cjs" -o -name "*.mjs" -o -name "*.py" \) ! -path "*/node_modules/*" ! -path "*/.next/*" ! -path "*/.git/*" ! -path "*/_reports/*" -exec sed -i '' \
  -e 's/\bSIRA\b/SYRA/g' \
  -e 's/\bsira\b/syra/g' \
  -e 's/\bSira\b/Syra/g' \
  -e 's/@sira\.com/@syra.com.sa/g' \
  {} +

echo "Replacement complete"
