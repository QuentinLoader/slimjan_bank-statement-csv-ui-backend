import { buildBankStatementExtraction } from "../../extractor/index.js";

export async function extractBankStatement(context) {
  return buildBankStatementExtraction(context);
}