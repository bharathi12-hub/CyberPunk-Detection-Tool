/**
 * Download Engine
 * Checks: Dangerous extensions (.exe, .bat, .scr, .ps1), Double extensions (invoice.pdf.exe),
 * Suspicious archives (.zip, .rar)
 * Output: "High Risk Download" classification
 */

const DANGEROUS_EXTENSIONS = ['exe', 'bat', 'scr', 'ps1', 'vbs', 'cmd', 'msi', 'jar', 'com', 'pif'];
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz'];
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];

function getExtensionParts(filename) {
  const parts = filename.toLowerCase().split('.').filter(Boolean);
  return parts.slice(1); // drop the base filename, keep all extension segments
}

/**
 * Detects "double extension" tricks like invoice.pdf.exe — a document-looking
 * name with an executable hiding as the real, final extension.
 */
function hasDoubleExtensionTrick(extParts) {
  if (extParts.length < 2) return false;
  const finalExt = extParts[extParts.length - 1];
  const precedingExt = extParts[extParts.length - 2];
  return DANGEROUS_EXTENSIONS.includes(finalExt) && DOCUMENT_EXTENSIONS.includes(precedingExt);
}

/**
 * Main entry point. Called by background-worker on chrome.downloads.onCreated.
 * @param {object} download - { filename, url, fileSize, mimeType }
 */
export function analyzeDownload(download) {
  const { filename, url } = download;
  const extParts = getExtensionParts(filename);
  const finalExt = extParts[extParts.length - 1] || '';

  const reasons = [];
  let riskLevel = 'Low Risk';

  const isDangerous = DANGEROUS_EXTENSIONS.includes(finalExt);
  const isArchive = ARCHIVE_EXTENSIONS.includes(finalExt);
  const isDoubleExtension = hasDoubleExtensionTrick(extParts);

  if (isDoubleExtension) {
    reasons.push(`Filename disguises an executable behind a document extension (.${extParts[extParts.length - 2]}.${finalExt})`);
    riskLevel = 'High Risk';
  } else if (isDangerous) {
    reasons.push(`File type ".${finalExt}" can execute code directly on your system`);
    riskLevel = 'High Risk';
  } else if (isArchive) {
    reasons.push(`Archive files (.${finalExt}) can hide executables inside — contents not scanned until extracted`);
    riskLevel = 'Medium Risk';
  }

  // Downloads served over plain HTTP are tamperable in transit
  if (url && url.startsWith('http://')) {
    reasons.push('File served over unencrypted HTTP — could be tampered with in transit');
    if (riskLevel === 'Low Risk') riskLevel = 'Medium Risk';
  }

  return {
    filename,
    extension: finalExt,
    riskLevel,
    isHighRisk: riskLevel === 'High Risk',
    reasons,
  };
}
