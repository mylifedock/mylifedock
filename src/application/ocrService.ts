import Tesseract, { type Worker } from "tesseract.js";

export interface ParsedReceiptData {
  rawText: string;
  vendor?: string;
  date?: string;
  totalAmount?: number;
  currency?: string;
  warrantyMonths?: number;
}

// Persistent worker to avoid re-loading language data on every scan
let workerPromise: Promise<Worker> | null = null;

// OCR assets are self-hosted (see selfHostedOcrAssets in vite.config.ts) so
// they load under the app's CSP, work offline, and never touch a CDN.
function ocrAssetUrl(relativePath: string): string {
  return new URL(`${import.meta.env.BASE_URL}tesseract/${relativePath}`, window.location.href).href;
}

async function getOcrWorker(onProgress?: (p: number) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng", 1, {
      workerPath: ocrAssetUrl("worker.min.js"),
      corePath: ocrAssetUrl("core"),
      langPath: ocrAssetUrl("lang"),
      workerBlobURL: false,
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    }).catch((err) => {
      workerPromise = null; // Allow retry on failure
      throw err;
    });
  }
  return workerPromise;
}

export async function cleanupOcrWorker(): Promise<void> {
  if (workerPromise) {
    try {
      const worker = await workerPromise;
      await worker.terminate();
    } catch {
      // Worker failed to initialize, nothing to clean up
    }
    workerPromise = null;
  }
}

/**
 * Extracts text locally from an image using Tesseract.js WebAssembly worker.
 * Uses a persistent worker for massive speed improvements on subsequent scans.
 */
export async function extractTextFromImage(
  image: File | Blob,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const worker = await getOcrWorker(onProgress);
    const result = await worker.recognize(image);
    return result.data.text;
  } catch (error) {
    console.error("OCR Extraction Error:", error);
    throw new Error("Failed to extract text from the image.", { cause: error });
  }
}

/**
 * Parses raw receipt/invoice OCR text to intelligently extract key metadata
 */
export function parseReceiptData(text: string): ParsedReceiptData {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const result: ParsedReceiptData = { rawText: text };

  // 1. Try to extract Vendor (usually in the first 3 lines)
  if (lines.length > 0) {
    // Pick the cleanest non-numeric top line as candidate vendor
    const candidate = lines.slice(0, 3).find(l => l.length > 2 && !/^\d+$/.test(l) && !/invoice|receipt|tax|bill/i.test(l));
    if (candidate) {
      result.vendor = candidate.slice(0, 50);
    }
  }

  // 2. Extract Date (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY)
  const dateRegex = /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    try {
      const rawDateStr = dateMatch[0];
      // Check if it's DD/MM/YYYY or DD-MM-YYYY (common in India and Europe)
      const parts = rawDateStr.split(/[-/.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          const [y, m, d] = parts;
          result.date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        } else if (parts[2].length === 4) {
          // DD-MM-YYYY or MM-DD-YYYY
          const p1 = parseInt(parts[0], 10);
          const p2 = parseInt(parts[1], 10);
          const y = parts[2];
          // Indian receipts write day first. Only a second part above 12 means
          // month-first (US style). No Date/UTC conversion, so the day never shifts.
          const [day, month] = p2 > 12 && p1 <= 12 ? [p2, p1] : [p1, p2];
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            result.date = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          }
        }
      }
    } catch {
      // ignore date parse failure
    }
  }

  // 3. Extract Total Amount (e.g., Total: $149.99, Amount: ₹4,500.00, Rs. 1,499.00, Grand Total: 2,500)
  /* eslint-disable security/detect-unsafe-regex */
  const amountPatterns = [
    // Pattern 1: Keywords like Total, Grand Total, Net, Amount followed by numbers with optional commas
    /(?:total|grand\s*total|net\s*amount|amount\s*paid|balance\s*due|final\s*amount)\s*[:=]?\s*(?:rs\.?|inr|usd|eur|gbp|[$€£₹])?\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
    // Pattern 2: Currency symbol followed by number with commas
    /(?:[$€£₹]|rs\.?|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  ];
  /* eslint-enable security/detect-unsafe-regex */

  let detectedTotal = 0;
  for (const regex of amountPatterns) {
    const matches = text.matchAll(regex);
    for (const m of matches) {
      const cleanNumStr = (m[1] ?? "").replace(/,/g, "").trim();
      const num = parseFloat(cleanNumStr);
      if (!isNaN(num) && num > detectedTotal && num < 100000000) {
        detectedTotal = num;
      }
    }
  }

  if (detectedTotal > 0) {
    result.totalAmount = detectedTotal;
  }

  // Detect currency symbol
  if (text.includes("₹") || /inr|rupees|rs\.?/i.test(text)) result.currency = "INR";
  else if (text.includes("€") || /eur|euro/i.test(text)) result.currency = "EUR";
  else if (text.includes("£") || /gbp/i.test(text)) result.currency = "GBP";
  else if (text.includes("$") || /usd|dollars/i.test(text)) result.currency = "USD";

  // 4. Extract Warranty (e.g. 1 year warranty, 24 months warranty)
  const warrantyRegex = /(\d+)\s*(year|month)s?\s*warranty/i;
  const warrantyMatch = text.match(warrantyRegex);
  if (warrantyMatch) {
    const qty = parseInt(warrantyMatch[1], 10);
    if (/year|yr/i.test(warrantyMatch[0])) {
      result.warrantyMonths = qty * 12;
    } else {
      result.warrantyMonths = qty;
    }
  }

  return result;
}
