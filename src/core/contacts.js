export const STATEMENT_CONTRACT = {
  requiredMetadata: [
    "bank",
    "account_holder.full_name",
    "statement_period.from",
    "statement_period.to",
    "currency"
  ],
  transactionColumns: [
    "date",
    "description",
    "debit",
    "credit",
    "fee",
    "balance"
  ]
};
