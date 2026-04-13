/**
 * YouScan 2.0
 * Classification result types
 */

export type DocumentType =
  | "bank_statement"
  | "invoice"
  | "delivery_note"
  | "proof_of_delivery"
  | "waybill"
  | "unknown";

export type DocumentSubtype =
  | "absa_statement"
  | "fnb_statement"
  | "nedbank_statement"
  | "capitec_statement"
  | "discovery_statement"
  | "generic_invoice"
  | "generic_delivery_note"
  | "generic_pod"
  | "generic_waybill"
  | "unknown";

export interface ClassificationResult {
  documentType: DocumentType;
  documentSubtype: DocumentSubtype;
  confidence: number;
  supported: boolean;
  reasons: string[];
  suggestedPipeline?: string | null;
  fileName?: string;
}