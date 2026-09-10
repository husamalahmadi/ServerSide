/**
 * Exports a DOM element as a branded PDF using html2canvas and jsPDF.
 */
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const BRAND = { r: 44, g: 123, b: 229 };
const GOLD = { r: 201, g: 168, b: 76 };
const MARGIN_MM = 12;
const HEADER_MM = 16;
const FOOTER_MM = 10;

function accentColor(meta) {
  if (meta?.theme === "gold") return GOLD;
  if (meta?.accent && Number.isFinite(meta.accent.r)) return meta.accent;
  return BRAND;
}

function drawPageChrome(pdf, pageNum, totalPages, meta) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const accent = accentColor(meta);

  pdf.setDrawColor(accent.r, accent.g, accent.b);
  pdf.setLineWidth(0.35);
  pdf.line(MARGIN_MM, HEADER_MM, pageWidth - MARGIN_MM, HEADER_MM);

  pdf.setFillColor(accent.r, accent.g, accent.b);
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

export async function exportElementAsPdf(element, filename = "report.pdf", meta = {}, options = {}) {
  if (!element) return;

  document.body.classList.add("tp-pdf-export");
  let canvas;
  try {
    canvas = await html2canvas(element, {
      scale: options.scale ?? 2,
      useCORS: true,
      logging: false,
      backgroundColor: options.backgroundColor ?? "#ffffff",
      windowWidth: Math.max(element.scrollWidth, element.clientWidth, 800),
      height: Math.max(element.scrollHeight, element.clientHeight, 1),
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

function waitForImages(root) {
  const imgs = [...(root.querySelectorAll?.("img") || [])];
  return Promise.all(
    imgs.map((img) => {
      if (img.complete) return null;
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }),
  );
}

/**
 * Capture an iframe's rendered report (including Chart.js canvases) as a branded PDF.
 * Clones into the parent document so html2canvas can read styles and pixels.
 */
export async function exportIframeDocumentAsPdf(iframe, filename, meta = {}, options = {}) {
  const idoc = iframe?.contentDocument;
  if (!idoc?.body) throw new Error("Report is not ready to export");

  const bg = options.backgroundColor ?? "#0a1628";
  const sourceWidth = Math.max(idoc.body.scrollWidth, idoc.documentElement.scrollWidth, 800);

  const host = document.createElement("div");
  host.setAttribute("data-tp-ai-pdf-host", "1");
  host.style.cssText = [
    "position:fixed",
    "left:-12000px",
    "top:0",
    `width:${sourceWidth}px`,
    "z-index:0",
    "pointer-events:none",
    `background:${bg}`,
  ].join(";");

  for (const node of idoc.querySelectorAll("style")) {
    host.appendChild(node.cloneNode(true));
  }

  const wrap = document.createElement("div");
  wrap.setAttribute("dir", idoc.documentElement.getAttribute("dir") || "ltr");
  wrap.lang = idoc.documentElement.lang || "";
  wrap.style.cssText = `font-family: Inter, 'Segoe UI', sans-serif; background:${bg}; color:#e8e8e8;`;
  wrap.innerHTML = idoc.body.innerHTML;
  wrap.querySelectorAll("script").forEach((s) => s.remove());

  const srcCanvases = [...idoc.querySelectorAll("canvas")];
  const dstCanvases = [...wrap.querySelectorAll("canvas")];
  srcCanvases.forEach((src, i) => {
    const dst = dstCanvases[i];
    if (!dst) return;
    let dataUrl = "";
    try {
      dataUrl = src.toDataURL("image/png");
    } catch {
      return;
    }
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "";
    const w = src.clientWidth || src.width;
    const h = src.clientHeight || src.height;
    img.width = w;
    img.height = h;
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    img.style.display = "block";
    img.style.maxWidth = "100%";
    dst.replaceWith(img);
  });

  host.appendChild(wrap);
  document.body.appendChild(host);

  try {
    await waitForImages(wrap);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await exportElementAsPdf(wrap, filename, meta, { ...options, backgroundColor: bg });
  } finally {
    host.remove();
  }
}
