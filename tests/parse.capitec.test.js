import fs from "fs";
import { parseStatement } from "../src/services/parseStatement.js";

test("Capitec statement parses deterministically", async () => {
  const buffer = fs.readFileSync("tests/fixtures/capitec_dec_2025_jan_2026.pdf");

  const result = await parseStatement(buffer);

  expect(result.statement.bank).toBe("capitec");
  expect(result.statement.account_holder.full_name).toBe("QUENTIN LOADER");
  expect(result.transactions.length).toBeGreaterThan(0);
  expect(result.warnings).toBeDefined();
});
