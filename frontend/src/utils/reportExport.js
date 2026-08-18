import api from '../services/api';

export async function exportToExcel(a, b, c, onError = () => {}) {
  let title, columns, rows, filename;

  if (a && typeof a === 'object' && a.rows !== undefined) {
    title = a.title;
    columns = a.columns;
    rows = a.rows;
    filename = a.filename || title;
  } else {
    rows = a;
    columns = b;
    filename = c;
    title = filename || 'Dados';
  }

  const processedColumns = columns.map(col => ({
    header: col.header,
    width: col.width || 15,
  }));

  const processedRows = rows.map(row => {
    const obj = {};
    columns.forEach(col => {
      let val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
      if (col.format) val = col.format(val, row);
      obj[col.header] = val ?? '';
    });
    return obj;
  });

  try {
    const res = await api.post('/reports/export-excel', {
      title,
      columns: processedColumns,
      rows: processedRows,
      filename,
    }, { responseType: 'blob' });

    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename || title}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    onError('Erro ao exportar planilha. Tente novamente.');
    console.error('Export error:', err);
  }
}

export function printReport(title) {
  const content = document.getElementById('report-content');
  if (!content) return;

  const styleTags = Array.from(document.querySelectorAll('style'));
  const linkSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  const extraStyles = [...styleTags, ...linkSheets].map(el => el.outerHTML).join('\n');

  const dashIdx = title.lastIndexOf(' - ');
  const mainTitle = dashIdx >= 0 ? title.slice(0, dashIdx) : title;
  const periodStr = dashIdx >= 0 ? title.slice(dashIdx + 3) : '';

  const win = window.open('', '_blank');
  win.document.write(`
    <html>
    <head>
      <title>${mainTitle}</title>
      ${extraStyles}
      <style>
        body { margin:0; padding:0; font-family:system-ui,-apple-system,sans-serif; background:#fff; }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        .report-wrap { max-width:700px; margin:0 auto; padding:0 16px 16px; }
        h1 { font-size:24px; font-weight:700; margin:0 0 4px; }
        .period { font-size:14px; color:#555; margin:4px 0 2px; }
        .generated { font-size:12px; color:#888; margin-bottom:16px; }
        @media print { body { padding:0; } }
      </style>
    </head>
    <body>
      ${printToolbar}
      <div class="report-wrap">
        <h1>${mainTitle}</h1>
        ${periodStr ? `<p class="period">Per\u00edodo: ${periodStr}</p>` : ''}
        <p class="generated">Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
        ${content.innerHTML}
      </div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export function printTable(title, columns, data) {
  const headerCells = columns.map(col => {
    const align = col.align || 'left';
    return `<th style="text-align:${align}">${col.header}</th>`;
  }).join('');

  const bodyRows = data.map(row => {
    const cells = columns.map(col => {
      const align = col.align || 'left';
      return `<td style="text-align:${align}">${col.accessor(row) ?? '-'}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const lines = title.split('\n').filter(Boolean);
  const h2 = lines[0] || title;
  const subtitleLines = lines.slice(1).map(l => `<p style="margin:2px 0;font-size:12px;color:#444">${l}</p>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { margin:0; padding:0; font-family:system-ui,-apple-system,sans-serif; background:#fff; }
        .no-print { display: none !important; }
        .report-wrap { max-width:700px; margin:0 auto; padding:0 16px 16px; }
        h2 { margin:0 0 5px; }
        table { border-collapse: collapse; width:100%; }
        th { border:1px solid #ccc; padding:6px 10px; background:#f3f4f6; font-size:12px; white-space:nowrap; }
        td { border:1px solid #ddd; padding:5px 8px; font-size:12px; white-space:nowrap; }
        .subtitle { margin:2px 0; font-size:12px; color:#444; }
        .generated { color:#888; font-size:11px; margin-bottom:16px; }
        @media print { body { padding:0; } }
      </style>
    </head>
    <body>
      ${printToolbar}
      <div class="report-wrap">
        <h2>${h2}</h2>
        ${subtitleLines}
        <p class="generated">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      <script>setTimeout(() => window.print(), 400);</script>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
}

const printToolbar = `
<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:8px 12px;background:#f3f4f6;border-radius:8px;font-family:system-ui,-apple-system,sans-serif;position:sticky;top:0;z-index:999">
  <span style="font-size:13px;color:#666">Pr\u00e9-visualiza\u00e7\u00e3o de impress\u00e3o</span>
  <div style="display:flex;gap:6px">
    <button onclick="window.print()" style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;background:#0d9488;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
      Imprimir
    </button>
    <button onclick="window.close()" style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;background:white;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      Fechar
    </button>
  </div>
</div>`;
