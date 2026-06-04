// Export helpers — Excel via SheetJS, PDF via native print dialog (Arabic-safe)
import * as XLSX from "xlsx";

export function exportToExcel(filename: string, sheets: { name: string; rows: any[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    // RTL sheet view
    (ws as any)["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Print a target element as a styled PDF via the browser print dialog.
 * Browser-native print supports Arabic perfectly using system fonts.
 */
export function printElement(elementId: string, title = "تقرير ميزان") {
  const el = document.getElementById(elementId);
  if (!el) return;
  const w = window.open("", "_blank", "width=1024,height=800");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head>
    <meta charset="utf-8"/>
    <title>${title}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap"/>
    <style>
      body { font-family: Cairo, system-ui, sans-serif; padding: 24px; color: #111; background: #fff; }
      h1,h2,h3 { color: #8a6a00; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 12px; }
      th { background: #f7eccb; }
      .glass-card, [class*="card"] { border: 1px solid #eee; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: #fff; }
      .gold-text { color: #8a6a00; }
      .recharts-wrapper svg { background: #fff; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>${title}</h1>
    <div>${el.innerHTML}</div>
    <script>window.onload=()=>{setTimeout(()=>{window.print();},400);};</script>
  </body></html>`);
  w.document.close();
}
