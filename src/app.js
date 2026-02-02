import { useState } from "react";

function App() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/parse", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    const res = await fetch("/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result)
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "statement.csv";
    a.click();
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>SlimJan</h1>
      <p>Bank statement → CSV (processed in memory only)</p>

      <input type="file" accept="application/pdf" onChange={handleUpload} />

      {loading && <p>Processing…</p>}

      {error && (
        <div style={{ color: "red", marginTop: 16 }}>
          <strong>Parsing failed:</strong> {error}
        </div>
      )}

      {result && (
        <>
          <Metadata summary={result.statement} />

          {result.warnings.length > 0 && (
            <div style={{ background: "#fff3cd", padding: 12, marginTop: 12 }}>
              <strong>Warnings:</strong>
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <TransactionsTable rows={result.transactions} />

          <button onClick={exportCsv} style={{ marginTop: 16 }}>
            Export CSV
          </button>
        </>
      )}
    </div>
  );
}

function Metadata({ summary }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div><strong>Account Holder:</strong> {summary.account_holder.full_name}</div>
      <div><strong>Bank:</strong> {summary.bank}</div>
      <div>
        <strong>Period:</strong> {summary.statement_period.from} →{" "}
        {summary.statement_period.to}
      </div>
    </div>
  );
}

function TransactionsTable({ rows }) {
  return (
    <table border="1" cellPadding="6" style={{ marginTop: 16 }}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Debit</th>
          <th>Credit</th>
          <th>Fee</th>
          <th>Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.date}</td>
            <td>{r.description}</td>
            <td>{r.debit || ""}</td>
            <td>{r.credit || ""}</td>
            <td>{r.fee || ""}</td>
            <td>{r.balance}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default App;
