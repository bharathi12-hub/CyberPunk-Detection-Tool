/**
 * Minimal DOCX Builder
 * Hand-assembles a valid, minimal Word (.docx) document from plain text
 * content — no external DOCX library needed (those require a bundler,
 * which Manifest V3 extensions can't use). A .docx is just a ZIP archive
 * containing a fixed set of XML parts; this builds exactly the required
 * parts using the vendored fflate zipSync for the archive itself.
 *
 * Supports headings (lines starting with "## ") and plain paragraphs,
 * which is exactly the shape report-generator.js produces.
 */

import { zipSync, strToU8 } from './fflate.esm.js';

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts plain report text (as produced by renderReportAsText) into
 * Word-XML paragraph elements. Lines starting with "## " become Heading2
 * style; lines starting with "  - " become indented bullet-style text;
 * everything else is a normal paragraph.
 */
function textToBodyXml(text) {
  const lines = text.split('\n');
  const paragraphs = lines.map((line) => {
    if (line.startsWith('## ')) {
      const content = escapeXml(line.slice(3));
      return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t xml:space="preserve">${content}</w:t></w:r></w:p>`;
    }
    if (line.startsWith('  - ')) {
      const content = escapeXml(line.slice(4));
      return `<w:p><w:pPr><w:ind w:left="360"/></w:pPr><w:r><w:t xml:space="preserve">• ${content}</w:t></w:r></w:p>`;
    }
    if (line.trim() === '') {
      return `<w:p/>`;
    }
    const content = escapeXml(line);
    return `<w:p><w:r><w:t xml:space="preserve">${content}</w:t></w:r></w:p>`;
  });
  return paragraphs.join('');
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="28"/></w:rPr>
  </w:style>
</w:styles>`;

function buildDocumentXml(title, bodyText) {
  const titleXml = `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t xml:space="preserve">${escapeXml(title)}</w:t></w:r></w:p>`;
  const bodyXml = textToBodyXml(bodyText);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${titleXml}
    ${bodyXml}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;
}

/**
 * Builds a minimal valid .docx file (as a Uint8Array, ready for a Blob)
 * from a title and plain-text body.
 * @param {string} title
 * @param {string} bodyText
 * @returns {Uint8Array}
 */
export function buildDocx(title, bodyText) {
  const files = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES_XML),
    '_rels/.rels': strToU8(ROOT_RELS_XML),
    'word/document.xml': strToU8(buildDocumentXml(title, bodyText)),
    'word/_rels/document.xml.rels': strToU8(DOCUMENT_RELS_XML),
    'word/styles.xml': strToU8(STYLES_XML),
  };

  // mtime must fall within the ZIP format's valid DOS-date range (1980-2099).
  // level: 0 (store) is simplest/most compatible since DOCX readers don't
  // require deflate compression.
  return zipSync(files, { level: 0, mtime: new Date(2024, 0, 1) });
}
