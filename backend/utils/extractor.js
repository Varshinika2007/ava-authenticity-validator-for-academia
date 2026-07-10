const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const JSZip = require('jszip');

/**
 * Main extractor routing function
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} filename - Name of the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} Extracted text content
 */
async function extractText(buffer, filename, mimeType) {
  const extension = filename.split('.').pop().toLowerCase();

  try {
    if (extension === 'txt') {
      return buffer.toString('utf-8');
    }
    
    if (extension === 'pdf' || mimeType === 'application/pdf') {
      return await extractPDF(buffer);
    }
    
    if (extension === 'docx') {
      return await extractDOCX(buffer);
    }
    
    if (extension === 'doc') {
      return await extractLegacyDOC(buffer);
    }
    
    if (extension === 'pptx') {
      return await extractPPTX(buffer);
    }
    
    if (extension === 'ppt') {
      return await extractLegacyPPT(buffer);
    }
    
    if (['png', 'jpg', 'jpeg'].includes(extension) || mimeType.startsWith('image/')) {
      return await extractImageOCR(buffer);
    }
    
    throw new Error(`Unsupported file type: ${extension}`);
  } catch (error) {
    console.error(`[Extraction Error] Failed parsing file "${filename}":`, error);
    throw error;
  }
}

// 1. PDF Extract using pdf-parse
async function extractPDF(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

// 2. Word DOCX Extract using mammoth
async function extractDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer: buffer });
  return result.value;
}

// 3. PowerPoint PPTX Extract using JSZip
async function extractPPTX(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files).filter(fileName => 
    fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')
  );

  if (slideFiles.length === 0) {
    throw new Error('No slide files found in PPTX presentation.');
  }

  // Sort slide files numerically
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.replace('ppt/slides/slide', '').replace('.xml', ''), 10);
    const numB = parseInt(b.replace('ppt/slides/slide', '').replace('.xml', ''), 10);
    return numA - numB;
  });

  let fullText = '';
  const tagRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g;

  for (const slideFile of slideFiles) {
    const xmlText = await zip.files[slideFile].async('string');
    let match;
    let slideText = '';
    while ((match = tagRegex.exec(xmlText)) !== null) {
      slideText += match[1] + ' ';
    }
    if (slideText.trim().length > 0) {
      fullText += slideText + '\n';
    }
  }

  return fullText;
}

// 4. Image OCR using Tesseract.js
async function extractImageOCR(buffer) {
  const result = await Tesseract.recognize(buffer, 'eng');
  return result.data.text;
}

// 5. Legacy DOC binary extraction (strings filter fallback)
async function extractLegacyDOC(buffer) {
  const uint8Array = new Uint8Array(buffer);
  let text = '';
  let temp = '';
  
  for (let i = 0; i < uint8Array.length; i++) {
    const charCode = uint8Array[i];
    if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13) {
      temp += String.fromCharCode(charCode);
    } else {
      if (temp.length >= 8) {
        text += temp + ' ';
      }
      temp = '';
    }
  }
  
  return text
    .replace(/[^\x20-\x7E\r\n]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 6. Legacy PPT binary extraction (strings filter fallback)
async function extractLegacyPPT(buffer) {
  const uint8Array = new Uint8Array(buffer);
  let text = '';
  let temp = '';
  
  for (let i = 0; i < uint8Array.length; i++) {
    const charCode = uint8Array[i];
    if (charCode >= 32 && charCode <= 126) {
      temp += String.fromCharCode(charCode);
    } else {
      if (temp.length >= 6) {
        text += temp + ' ';
      }
      temp = '';
    }
  }
  
  return text
    .replace(/ActiveX/gi, '')
    .replace(/Microsoft/gi, '')
    .replace(/PowerPoint/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  extractText
};
