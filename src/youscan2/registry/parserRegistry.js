/**
 * YouScan 2.0
 * Parser registry
 */

import { bankStatementPlugin } from "../plugins/bankStatement/bankStatement.plugin";
import type { ClassificationResult } from "../types/classification";
import type { ParserPlugin } from "../types/parserPlugin";

const parsers: ParserPlugin[] = [bankStatementPlugin];

export function getParserByKey(parserKey: string): ParserPlugin | null {
  return parsers.find((parser) => parser.key === parserKey) || null;
}

export function getParserForClassification(
  classification: ClassificationResult
): ParserPlugin | null {
  return parsers.find((parser) => parser.canHandle(classification)) || null;
}