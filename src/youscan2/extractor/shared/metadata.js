import { normalizeWhitespace } from "./utils.js";
import { parseSignedMoney, parseStandardBankBalanceToken } from "./money.js";

export function extractAccountNumber(text) {
  const patterns = [
    /account number[:\s]*([0-9][0-9\s]{6,30})/i,
    /acc(?:ount)?\s*(?:no|number)?[:\s]*([0-9][0-9\s]{6,30})/i,
    /account no[:\s]*([0-9][0-9\s]{6,30})/i,
    /cheque account[:\s]*([0-9][0-9\s]{6,30})/i,
    /Cheque Account Number:\s*([0-9][0-9\s-]{6,30})/i,
  ];

  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) {
      const digits = match[1].replace(/\D/g, "");
      if (digits.length >= 6) return digits;
    }
  }

  return null;
}

export function extractClientName(text) {
  const patterns = [
    /account holder[:\s]+([A-Z][A-Z\s'.&-]{3,80})/i,
    /customer name[:\s]+([A-Z][A-Z\s'.&-]{3,80})/i,
    /name[:\s]+([A-Z][A-Z\s'.&-]{3,80})/i,
    /\b(MR\.\s+[A-Z][A-Z\s'.&-]{2,80})\b/i,
    /\b(MRS\.\s+[A-Z][A-Z\s'.&-]{2,80})\b/i,
    /\b(MS\.\s+[A-Z][A-Z\s'.&-]{2,80})\b/i,
  ];

  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) return normalizeWhitespace(match[1]);
  }

  return null;
}

export function extractBalanceByPatterns(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) {
      const value = parseSignedMoney(match[1]);
      if (value !== null) return value;
    }
  }

  return null;
}

export function extractOpeningBalance(text) {
  return extractBalanceByPatterns(text, [
    /opening balance[:\s]+([0-9,\s.:-]+)/i,
    /balance brought forward[:\s]+([0-9,\s.:-]+)/i,
    /bal brought forward[:\s]+([0-9,\s.:-]+)/i,
    /BALANCE BROUGHT FORWARD\s+([0-9,\s.:-]+)/i,
  ]);
}

export function extractClosingBalance(text) {
  return extractBalanceByPatterns(text, [
    /closing balance[:\s]+([0-9,\s.:-]+)/i,
    /final balance[:\s]+([0-9,\s.:-]+)/i,
    /current balance[:\s]+([0-9,\s.:-]+)/i,
    /Month-end BalanceR?([0-9,\s.:-]+)/i,
    /Balance\s+([0-9,\s.:-]+)\s*$/im,
  ]);
}

export function extractStatementPeriod(text) {
  const patterns = [
    /statement period[:\s]+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})\s+(?:to|-)\s+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i,
    /period[:\s]+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})\s+(?:to|-)\s+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i,
    /from[:\s]+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})\s+(?:to|-)\s+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i,
    /Statement from\s+([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})\s+to\s+([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
    /Your transactions\s*([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4})\s*to\s*([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4})/i,
  ];

  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) {
      return {
        start: normalizeWhitespace(match[1]),
        end: normalizeWhitespace(match[2]),
      };
    }
  }

  return { start: null, end: null };
}

export function extractStandardBankOpeningBalance(text) {
  const patterns = [
    /BALANCE BROUGHT FORWARD\s+([0-9,\s.:-]+)/i,
    /balance brought forward[:\s]+([0-9,\s.:-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) {
      const value = parseStandardBankBalanceToken(match[1]);
      if (value !== null) return value;
    }
  }

  return null;
}

export function extractStandardBankClosingBalance(text) {
  const patterns = [
    /Month-end BalanceR?([0-9,\s.:-]+)/i,
    /closing balance[:\s]+([0-9,\s.:-]+)/i,
    /final balance[:\s]+([0-9,\s.:-]+)/i,
    /current balance[:\s]+([0-9,\s.:-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) {
      const value = parseStandardBankBalanceToken(match[1]);
      if (value !== null) return value;
    }
  }

  return null;
}