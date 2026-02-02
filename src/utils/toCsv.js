import { writeToString } from "fast-csv";

export function toCsv(rows) {
  return new Promise((resolve, reject) => {
    writeToString(rows, { headers: true })
      .then(resolve)
      .catch(reject);
  });
}
