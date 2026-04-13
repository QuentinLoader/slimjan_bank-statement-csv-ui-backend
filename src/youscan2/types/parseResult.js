/**
 * YouScan 2.0
 * Unified parse result envelope
 */

import type {
  ClassificationResult,
  DocumentType,
  DocumentSubtype,
} from "./classification";
import type { ValidationIssue, ValidationStatus } from "./validation";

export type ParseJobStatus =
  | "completed"
  | "failed"
  | "needs_review"
  | "unsupported";

export interface ParseResult<TData = unknown> {
  jobId: string;
  documentType: DocumentType;
  documentSubtype: DocumentSubtype;
  parserKey: string;
  parserVersion: string;
  schemaKey: string;
  confidence: number;
  validationStatus: ValidationStatus;
  issues: ValidationIssue[];
  data: TData;
  status: ParseJobStatus;
}

export interface FinalizeParseResultArgs<TData = unknown> {
  jobId: string;
  classification: ClassificationResult;
  parserKey: string;
  parserVersion: string;
  schemaKey: string;
  validationStatus: ValidationStatus;
  issues: ValidationIssue[];
  data: TData;
  status: ParseJobStatus;
  confidence?: number;
}