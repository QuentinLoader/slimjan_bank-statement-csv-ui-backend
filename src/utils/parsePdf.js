import pdf from "pdf-parse";

export async function parsePdf(buffer) {
  const data = await pdf(buffer);
  const lines = data.text.split("\n");

  const rows = [];

  for (const line of lines) {
    // VERY BASIC pattern — refine per bank later
    const match = line.match(
      /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?\d+\.\d{2})\s+(-?\d+\.\d{2})/
    );

    if (match) {
      rows.push({
        date: match[1],
        description: match[2].trim(),
        amount: match[3],
        balance: match[4]
      });
    }
  }

  return rows;
}
