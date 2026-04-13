export function mapSubtypeToBankName(subtype) {
  if (!subtype) return "unknown";

  const value = String(subtype).toLowerCase();

  if (value.includes("absa")) return "ABSA";
  if (value.includes("standard_bank")) return "Standard Bank";

  return "unknown";
}

export function isValidDateString(value) {
  if (!value) return false;

  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}