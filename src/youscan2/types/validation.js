/**
 * YouScan 2.0
 * Validation types
 */

export type ValidationSeverity = "info" | "warning" | "error";
export type ValidationStatus = "passed" | "passed_with_warnings" | "failed";

export interface ValidationIssue {
  severity: ValidationSeverity;
  issueType: string;
  message: string;
  rowIndex?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  status: ValidationStatus;
  issues: ValidationIssue[];
  score: number;
}