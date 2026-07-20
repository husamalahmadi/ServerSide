/**
 * Exports a DOM element as a branded PDF using html2canvas and jsPDF.
 */
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const BRAND = { r: 44, g: 123, b: 229 };
const MARGIN_MM = 12;
const HEADER_MM = 16;
const FOOTER_MM = 10;

function drawPageChrome(pdf, pageNum, totalPages, meta) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.setLineWidth(0.35);
  pdf.line(MARGIN_MM, HEADER_MM, pageWidth - MARGIN_MM, HEADER_MM);

  pdf.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.roundedRect(MARGIN_MM, 7, 8, 8, 1.5, 1.5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  pdf.setTextColor(255, 255, 255);
  pdf.text("TP", MARGIN_MM + 2.1, 12.2);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(18, 38, 63);
  pdf.text("TruePrice.Cash", MARGIN_MM + 10.5, 11.5);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(116, 129, 148);
  if (meta.title) {
    pdf.text(String(meta.title), MARGIN_MM + 10.5, 15);
  }
  if (meta.date) {
    pdf.text(String(meta.date), pageWidth - MARGIN_MM, 11.5, { align: "right" });
  }

  const footerY = pageHeight - FOOTER_MM;
  pdf.setDrawColor(227, 232, 239);
  pdf.setLineWidth(0.25);
  pdf.line(MARGIN_MM, footerY, pageWidth - MARGIN_MM, footerY);

  pdf.setFontSize(6.5);
  pdf.setTextColor(116, 129, 148);
  pdf.text(meta.disclaimer || "For informational purposes only. Not investment advice.", MARGIN_MM, pageHeight - 5);
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN_MM, pageHeight - 5, { align: "right" });
}

export async function exportElementAsPdf(element, filename = "report.pdf", meta = {}) {
  if (!element) return;

  document.body.classList.add("tp-pdf-export");
  let canvas;
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: element.scrollWidth,
    });
  } finally {
    document.body.classList.remove("tp-pdf-export");
  }

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentTop = MARGIN_MM + HEADER_MM + 2;
  const contentBottom = pageHeight - FOOTER_MM - 2;
  const contentHeight = contentBottom - contentTop;
  const contentWidth = pageWidth - MARGIN_MM * 2;

  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/png");

  const totalPages = Math.max(1, Math.ceil(imgHeight / contentHeight));

  for (let page = 0; page < totalPages; page += 1) {
    if (page > 0) pdf.addPage();
    drawPageChrome(pdf, page + 1, totalPages, meta);
    const yOffset = contentTop - page * contentHeight;
    pdf.addImage(imgData, "PNG", MARGIN_MM, yOffset, imgWidth, imgHeight);
  }

  pdf.save(filename);
}
