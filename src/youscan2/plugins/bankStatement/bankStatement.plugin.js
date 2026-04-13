/**
 * YouScan 2.0
 * Bank Statement Plugin
 */

import { DOCUMENT_TYPES } from "../../registry/documentTypes";
import type { ParseResult } from "../../types/parseResult";
import type { ParserPlugin } from "../../types/parserPlugin";
import type { ValidationResult } from "../../types/validation";

export interface BankStatementTransaction {
  date: string;
  description: string;
  amount: number;
  balance: number | null;
}

export interface BankStatementData {
  bankName: string;
  accountNumber: string | null;
  clientName: string | null;
  statementPeriodStart: string | null;
  statementPeriodEnd: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  transactions: BankStatementTransaction[];
  sourceFileName: string | null;
}

export const bankStatementPlugin: ParserPlugin<BankStatementData> = {
  key: "bank_statement.generic.v2",
  documentType: DOCUMENT_TYPES.BANK_STATEMENT,

  canHandle(classification) {
    return classification.documentType === DOCUMENT_TYPES.BANK_STATEMENT;
  },

  async extract(context) {
    const { file, classification } = context;

    return {
      sourceFileName: file?.originalname || "unknown.pdf",
      detectedSubtype: classification.documentSubtype,
      rawTextPreview: context.textPreview || "",
      transactions: [],
      metadata: {},
    };
  },

  async normalize(raw): Promise<BankStatementData> {
    const typedRaw = raw as {
      sourceFileName?: string;
      transactions?: BankStatementTransaction[];
    };

    return {
      bankName: "unknown",
      accountNumber: null,
      clientName: null,
      statementPeriodStart: null,
      statementPeriodEnd: null,
      openingBalance: null,
      closingBalance: null,
      transactions: typedRaw.transactions || [],
      sourceFileName: typedRaw.sourceFileName || null,
    };
  },

  async validate(): Promise<ValidationResult> {
    return {
      valid: true,
      status: "passed",
      issues: [],
      score: 1,
    };
  },

  async toFinalResult({
    jobId,
    classification,
    normalized,
    validation,
  }): Promise<ParseResult<BankStatementData>> {
    return {
      jobId,
      documentType: classification.documentType,
      documentSubtype: classification.documentSubtype,
      parserKey: this.key,
      parserVersion: "2.0.0",
      schemaKey: "bank_statement.v1",
      confidence: classification.confidence,
      validationStatus: validation.status,
      issues: validation.issues,
      data: normalized,
      status: validation.valid ? "completed" : "failed",
    };
  },
};