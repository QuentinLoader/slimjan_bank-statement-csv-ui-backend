/**
 * YouScan 2.0
 * Parser plugin contract
 */

import type { ClassificationResult } from "./classification";
import type { ParseResult } from "./parseResult";
import type { ValidationResult } from "./validation";

export interface SchemaRegistryEntry {
  schemaKey: string;
  documentType: string;
  version: string;
  parserKey: string;
  validatorKey: string;
  normalizerKey: string;
  active: boolean;
}

export interface ParserContext {
  jobId: string;
  file?: {
    originalname?: string;
    [key: string]: unknown;
  };
  extractedText?: string;
  textPreview?: string;
  classification: ClassificationResult;
  schema: SchemaRegistryEntry;
}

export interface ParserPlugin<TNormalized = unknown> {
  key: string;
  documentType: string;

  canHandle(classification: ClassificationResult): boolean;

  extract(context: ParserContext): Promise<unknown>;

  normalize(raw: unknown, context: ParserContext): Promise<TNormalized>;

  validate(
    normalized: TNormalized,
    context: ParserContext
  ): Promise<ValidationResult>;

  repair?(
    context: ParserContext,
    normalized: TNormalized,
    validation: ValidationResult
  ): Promise<TNormalized>;

  toFinalResult(args: {
    jobId: string;
    classification: ClassificationResult;
    normalized: TNormalized;
    validation: ValidationResult;
  }): Promise<ParseResult<TNormalized>>;
}