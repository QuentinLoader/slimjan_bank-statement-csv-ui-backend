/**
 * YouScan 2.0
 * File text extraction utility
 */

import pdfParse from "pdf-parse";

export async function extractTextFromFile(file) {
  if (!file || !file.buffer) {
    throw new Error("NO_FILE_BUFFER");
  }

  const fileName = file.originalname || "";
  const mimeType = file.mimetype || "";

  const isPdf =
    mimeType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf");

  const isText =
    mimeType.startsWith("text/") ||
    fileName.toLowerCase().endsWith(".txt");

  if (isPdf) {
    const result = await pdfParse(file.buffer);
    return {
      text: result.text || "",
      meta: {
        sourceType: "pdf",
        pages: result.numpages || null,
        info: result.info || null,
      },
    };
  }

  if (isText) {
    return {
      text: file.buffer.toString("utf8"),
      meta: {
        sourceType: "text",
        pages: 1,
        info: null,
      },
    };
  }

  return {
    text: file.buffer.toString("utf8"),
    meta: {
      sourceType: "unknown",
      pages: null,
      info: null,
    },
  };
}