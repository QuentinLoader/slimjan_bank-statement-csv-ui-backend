import crypto from "crypto";

export function generateOzowHash(data, privateKey) {
  const hashString =
    data.SiteCode +
    data.CountryCode +
    data.CurrencyCode +
    data.Amount +
    data.TransactionReference +
    data.BankReference +
    data.CancelURL +
    data.ErrorURL +
    data.SuccessURL +
    data.NotifyURL +
    data.IsTest +
    privateKey;

  console.log("OZOW HASH STRING:", hashString);

  const hash = crypto
    .createHash("sha512")
    .update(hashString, "utf-8")
    .digest("hex");

  console.log("OZOW HASH RESULT:", hash);

  return hash;
}