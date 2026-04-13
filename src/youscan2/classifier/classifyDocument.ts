/**
 * YouScan 2.0
 * Main classifier entry point
 */

import { heuristicClassifier } from "./heuristicClassifier";
import type { ClassificationResult } from "../types/classification";

interface ClassifyDocumentArgs {
  extractedText?: string;
  fileName?: string;
}

export async function classifyDocument({
  extractedText = "",
  fileName = "",
}: ClassifyDocumentArgs): Promise<ClassificationResult> {
  const classification = heuristicClassifier(extractedText);

  return {
    ...classification,
    fileName,
  };
}