import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface DownloadBrandingOptions {
  appName?: string;
  pageTitle?: string;
  subtitle?: string;
  brandColor?: string;
  brandColorAccent?: string;
}

/**
 * Downloads HTML content directly as a .html file.
 * Fixes blank-page issue with html2canvas for complex HTML.
 */
export const downloadAsHTML = (
  htmlContent: string,
  filename: string,
  branding?: DownloadBrandingOptions,
): void => {
  const appName   = branding?.appName   || 'IIC';
  const pageTitle = branding?.pageTitle || filename || 'Notes';
  const subtitle  = branding?.subtitle  || '';
  const brandColor = branding?.brandColor || '#4f46e5';
  const date = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // Collect all accessible CSS rules from the current page
  let cssText = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          cssText += rule.cssText + '\n';
        }
      } catch { /* cross-origin */ }
    }
  } catch {}

  const safeFilename = (filename || 'notes').replace(/[^a-zA-Z0-9_\-. ]/g, '_');

  const fullHtml = `<!DOCTYPE html>
<html lang="hi-IN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle} — ${appName}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; max-width: 900px; margin: 0 auto; background: #f8fafc; color: #1e293b; }
    .iic-header { background: ${brandColor}; color: white; padding: 12px 16px; border-radius: 8px 8px 0 0; }
    .iic-header strong { font-size: 15px; display: block; }
    .iic-header small { font-size: 11px; opacity: 0.85; margin-top: 3px; display: block; }
    .iic-content { background: white; padding: 16px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none; min-height: 200px; }
    .iic-footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 12px; padding: 8px; }
    ${cssText}
  </style>
</head>
<body>
  <div class="iic-header">
    <strong>${appName} — ${pageTitle}</strong>
    <small>${subtitle ? subtitle + ' · ' : ''}Downloaded: ${date}</small>
  </div>
  <div class="iic-content">
    ${htmlContent}
  </div>
  <div class="iic-footer">${appName} · ${pageTitle} · ${date}</div>
</body>
</html>`;

  try {
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${safeFilename}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); document.body.removeChild(a); } catch {}
    }, 1000);
  } catch (err) {
    console.error('[download] HTML generation failed:', err);
    alert('Download fail hua. Please try again.');
  }
};

/**
 * Download a DOM element by ID as a .html file (fixes blank-page issue).
 */
export const downloadElementAsHTML = (
  elementId: string,
  filename: string,
  branding?: DownloadBrandingOptions,
): void => {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`[download] Element #${elementId} not found`);
    alert('Download element not found. Please try again.');
    return;
  }
  downloadAsHTML(el.innerHTML, filename, branding);
};

export const downloadAsPDF = async (
  elementId: string,
  filename: string,
  branding?: DownloadBrandingOptions,
) => {
  await downloadAsMHTML(elementId, filename, branding);
};

/**
 * Captures the given DOM element as a high-quality PDF using html2canvas.
 * The output looks EXACTLY like what the student sees in the app —
 * all colours, tables, boxes, and icons are preserved.
 */
export const downloadAsMHTML = async (
  elementId: string,
  filename: string,
  branding?: DownloadBrandingOptions,
) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[download] Element #${elementId} not found`);
    return;
  }

  const appName    = branding?.appName    || 'IIC';
  const pageTitle  = branding?.pageTitle  || filename || 'Notes';
  const subtitle   = branding?.subtitle   || '';
  const brandColor = branding?.brandColor || '#4f46e5';

  try {
    const originalOverflow = element.style.overflow;
    const originalMaxHeight = element.style.maxHeight;
    element.style.overflow  = 'visible';
    element.style.maxHeight = 'none';

    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1024,
      scrollX: 0,
      scrollY: -window.scrollY,
    });

    element.style.overflow  = originalOverflow;
    element.style.maxHeight = originalMaxHeight;

    const A4_W_PT = 595.28;
    const A4_H_PT = 841.89;
    const MARGIN  = 20;

    const contentW = A4_W_PT - MARGIN * 2;
    const imgRatio = canvas.height / canvas.width;
    const fullImgH = contentW * imgRatio;

    const HEADER_H = 36;
    const FOOTER_H = 18;
    const usableH  = A4_H_PT - HEADER_H - FOOTER_H - MARGIN * 2;

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdfFormatHeight = fullImgH + HEADER_H + FOOTER_H + (MARGIN * 2);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [A4_W_PT, pdfFormatHeight] });

    pdf.setFillColor(brandColor);
    pdf.rect(0, 0, A4_W_PT, HEADER_H, 'F');
    pdf.setTextColor('#ffffff');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(appName, MARGIN, 15);
    pdf.setFontSize(11);
    pdf.text(pageTitle.slice(0, 60), MARGIN, 28);

    pdf.setFillColor('#f1f5f9');
    pdf.rect(0, pdfFormatHeight - FOOTER_H, A4_W_PT, FOOTER_H, 'F');
    pdf.setTextColor('#64748b');
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    const saved = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    pdf.text(`${subtitle}  ·  Saved ${saved}  ·  ${appName}`, A4_W_PT / 2, pdfFormatHeight - 5, { align: 'center' });

    pdf.addImage(imgData, 'JPEG', MARGIN, HEADER_H + MARGIN, contentW, fullImgH);

    pdf.save(`${filename}.pdf`);

  } catch (err) {
    console.error('[download] PDF generation failed:', err);
    alert('Download fail hua. Please try again.');
  }
};
