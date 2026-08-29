import Tesseract from "tesseract.js";

export interface ParsedReceiptData {
  rawText: string;
  vendor?: string;
  date?: string;
  totalAmount?: number;
  currency?: string;
  warrantyMonths?: number;
}

/**
 * Extracts text locally from an image using Tesseract.js WebAssembly worker.
 * @param image The image File or Blob to process.
 * @param onProgress Callback to track the OCR progress (0 to 100).
 * @returns The extracted text.
 */
export async function extractTextFromImage(
  image: File | Blob,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const result = await Tesseract.recognize(image, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
    
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

  // 2. Extract Date (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
  const dateRegex = /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    try {
      const parsedDate = new Date(dateMatch[0]);
      if (!isNaN(parsedDate.getTime())) {
        result.date = parsedDate.toISOString().slice(0, 10);
      }
    } catch {
      // ignore date parse failure
    }
  }

  // 3. Extract Total Amount (e.g., Total: $149.99, Amount: ₹4,500.00, EUR 99.00)
  const amountRegex = /[$€£₹]\s*([0-9.]+)/g;
  const matches = text.matchAll(amountRegex);
  let highestAmount = 0;
  for (const m of matches) {
    const rawVal = m[1] ?? "";
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > highestAmount && num < 10000000) {
      highestAmount = num;
    }
  }
  if (highestAmount > 0) {
    result.totalAmount = highestAmount;
  }

  // Detect currency symbol
  if (text.includes("₹") || /inr|rupees/i.test(text)) result.currency = "INR";
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
