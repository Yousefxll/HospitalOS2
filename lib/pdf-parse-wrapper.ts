/**
 * Wrapper for pdf-parse to handle CommonJS/ES module interop issues
 * Using a workaround for Next.js webpack bundling issues
 */

let pdfParseFn: any = null;

export async function getPdfParse() {
  if (pdfParseFn) {
    return pdfParseFn;
  }

  try {
    // Method 1: Try dynamic import (standard way)
    let pdfParseModule: any;
    try {
      pdfParseModule = await import('pdf-parse');
      console.log('pdf-parse module imported, type:', typeof pdfParseModule);
      console.log('pdf-parse module keys:', Object.keys(pdfParseModule || {}));
    } catch (importError: any) {
      console.error('Direct import failed:', importError.message);
      throw importError;
    }
    
    // Try to extract the function from the module
    // Next.js webpack may wrap CommonJS modules differently
    
    // List of known classes/exceptions to ignore (they start with capital letters)
    const classesToIgnore = new Set([
      'AbortException', 'FormatError', 'InvalidPDFException', 'PasswordException',
      'ResponseException', 'UnknownErrorException', 'Line', 'LineStore', 'Point',
      'Rectangle', 'Shape', 'Table', 'LineDirection', 'VerbosityLevel', 'getException',
      'PDFParse' // PDFParse might be a class too
    ]);
    
    // Check 1: default export (highest priority - this is usually where pdf-parse function is)
    if (pdfParseModule.default) {
      const defaultVal = pdfParseModule.default;
      const defaultType = typeof defaultVal;
      console.log(`default type: ${defaultType}`);
      
      if (defaultType === 'function') {
        pdfParseFn = defaultVal;
        console.log('✓ Found pdf-parse at .default (function)');
      } else if (defaultType === 'object' && defaultVal) {
        // default is an object, search inside it
        console.log('default is object, searching inside...');
        const defaultKeys = Object.keys(defaultVal);
        console.log('default keys:', defaultKeys);
        
        for (const key of defaultKeys) {
          const value = defaultVal[key];
          const valueType = typeof value;
          console.log(`  default.${key}: type=${valueType}`);
          
          // Ignore classes and look for a function that's not a class
          if (valueType === 'function' && !classesToIgnore.has(key)) {
            // Check if it's a class (has prototype.constructor)
            const isClass = value.prototype && value.prototype.constructor === value;
            if (!isClass) {
              console.log(`  → Found function at default.${key}, using it`);
              pdfParseFn = value;
              break;
            } else {
              console.log(`  → Skipping ${key} (it's a class)`);
            }
          }
        }
      }
    }
    
    // Check 2: Search top-level for a function (but ignore known classes)
    if (!pdfParseFn) {
      const mod = pdfParseModule as any;
      if (mod && typeof mod === 'object') {
        const allKeys = Object.keys(mod);
        console.log('Searching top-level for function (excluding classes)...');
        
        for (const key of allKeys) {
          // Skip known classes and default (already checked)
          if (classesToIgnore.has(key) || key === 'default' || key === '__esModule') {
            continue;
          }
          
          const value = mod[key];
          const valueType = typeof value;
          
          if (valueType === 'function') {
            // Check if it's a class
            const isClass = value.prototype && value.prototype.constructor === value;
            if (!isClass) {
              console.log(`  → Found function at "${key}", using it`);
              pdfParseFn = value;
              break;
            } else {
              console.log(`  → Skipping ${key} (it's a class)`);
            }
          }
        }
      }
    }
    
    // Check 3: Try PDFParse (might be the actual parser, but could be a class)
    if (!pdfParseFn && pdfParseModule.PDFParse) {
      const PDFParseValue = pdfParseModule.PDFParse;
      const PDFParseType = typeof PDFParseValue;
      console.log(`PDFParse type: ${PDFParseType}`);
      
      if (PDFParseType === 'function') {
        // Check if it's a class
        const isClass = PDFParseValue.prototype && PDFParseValue.prototype.constructor === PDFParseValue;
        if (!isClass) {
          pdfParseFn = PDFParseValue;
          console.log('✓ Found pdf-parse at .PDFParse (function)');
        } else {
          console.log('PDFParse is a class, skipping');
        }
      }
    }
    
    // Check 4: module itself
    if (!pdfParseFn && typeof pdfParseModule === 'function') {
      pdfParseFn = pdfParseModule;
      console.log('✓ Found pdf-parse as module itself');
    }

    // Final validation with detailed error
    if (typeof pdfParseFn !== 'function') {
      const moduleInfo = {
        type: typeof pdfParseModule,
        keys: Object.keys(pdfParseModule || {}),
        hasDefault: 'default' in (pdfParseModule || {}),
        defaultType: typeof (pdfParseModule as any)?.default,
        defaultKeys: (pdfParseModule as any)?.default && typeof (pdfParseModule as any)?.default === 'object' 
          ? Object.keys((pdfParseModule as any).default) 
          : null,
        hasPDFParse: 'PDFParse' in (pdfParseModule || {}),
        PDFParseType: typeof (pdfParseModule as any)?.PDFParse,
        __esModule: (pdfParseModule as any)?.__esModule,
        isFunction: typeof pdfParseModule === 'function',
      };
      
      console.error('✗ pdf-parse import failed. Full module info:', JSON.stringify(moduleInfo, null, 2));
      throw new Error('pdf-parse is not a function after import. Module structure logged above.');
    }

    console.log('✓ pdf-parse loaded successfully, type:', typeof pdfParseFn);
    return pdfParseFn;
  } catch (error: any) {
    console.error('✗ Failed to load pdf-parse:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 1000)
    });
    throw new Error(`PDF parsing library not available: ${error.message}`);
  }
}
