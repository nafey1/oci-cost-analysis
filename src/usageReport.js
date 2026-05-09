import ExcelJS from 'exceljs';

const COST_FIELDS = ['computedAmount', 'attributedCost', 'cost'];
const USAGE_FIELDS = ['computedQuantity', 'attributedUsage', 'quantity', 'usageQuantity', 'consumedQuantity', 'usageValue'];

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function firstDefined(row, fields) {
  for (const field of fields) {
    if (row[field] !== undefined && row[field] !== null && row[field] !== '') return row[field];
  }
  return '';
}

function amountFrom(row) {
  for (const field of COST_FIELDS) {
    const value = numberValue(row[field]);
    if (value) return value;
  }
  return numberValue(row.computedAmount);
}

function usageFrom(row) {
  return numberValue(firstDefined(row, USAGE_FIELDS));
}

function groupKey(row, groupBy) {
  return Object.values(groupValues(row, groupBy)).join(' | ');
}

function displayGroup(row, groupBy) {
  const values = groupValues(row, groupBy.filter((field) => field !== 'region'));
  return Object.values(values).join(' | ') || 'All Usage';
}

function groupValues(row, groupBy) {
  return Object.fromEntries(groupBy.map((field) => [
    field,
    displayValue(field, firstDefined(row, [field, camelCase(field)]))
  ]));
}

function displayValue(field, value) {
  if (field === 'compartmentPath') return compartmentHierarchy(value);
  return String(value || 'Unspecified');
}

function compartmentHierarchy(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'root';

  const parts = raw
    .replace(/^\/+|\/+$/g, '')
    .split(/\s*(?:\/|>|\\)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return 'root';
  if (parts[0].toLowerCase() !== 'root') parts.unshift('root');
  return parts.join(' / ');
}

function camelCase(value) {
  return String(value).replace(/[-_\s]+([a-zA-Z0-9])/g, (_, char) => char.toUpperCase());
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundCost(value) {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000;
}

export function buildUsageReport(items, query) {
  const rows = items.map((item) => ({ ...item }));
  const totals = rows.reduce(
    (acc, row) => {
      const cost = amountFrom(row);
      const usage = usageFrom(row);
      acc.cost += cost;
      acc.usage += usage;
      if (cost) acc.nonZeroCostRows += 1;
      if (usage) acc.nonZeroUsageRows += 1;
      return acc;
    },
    { cost: 0, usage: 0, nonZeroCostRows: 0, nonZeroUsageRows: 0 }
  );

  const byGroupMap = new Map();
  for (const row of rows) {
    const key = groupKey(row, query.groupBy) || 'Unspecified';
    const values = groupValues(row, query.groupBy);
    const current = byGroupMap.get(key) ?? {
      region: values.region || 'Unspecified',
      group: displayGroup(row, query.groupBy),
      groupValues: values,
      cost: 0,
      usage: 0,
      currency: firstDefined(row, ['currency', 'currencyCode']),
      count: 0
    };
    current.cost += amountFrom(row);
    current.usage += usageFrom(row);
    current.count += 1;
    byGroupMap.set(key, current);
  }

  const byGroup = Array.from(byGroupMap.values())
    .filter((row) => row.cost !== 0)
    .map((row) => ({
      ...row,
      cost: roundCost(row.cost),
      usage: row.usage,
      percentOfCost: totals.cost ? row.cost / totals.cost : 0
    }))
    .sort((a, b) => b.cost - a.cost || b.usage - a.usage);

  return {
    query,
    generatedAt: new Date().toISOString(),
    totals: {
      cost: roundCurrency(totals.cost),
      usage: totals.usage,
      rowCount: rows.length,
      nonZeroCostRows: totals.nonZeroCostRows,
      nonZeroUsageRows: totals.nonZeroUsageRows
    },
    byGroup,
    rows
  };
}

export function reportToCsv(report) {
  const columns = ['region', 'group', 'cost', 'usage', 'currency', 'percentOfCost', 'count'];
  const lines = [columns.join(',')];
  for (const row of report.byGroup) {
    lines.push(columns.map((column) => csvCell(row[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export async function reportToXlsxBuffer(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OCI Cost Usage App';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Grouped Usage', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheet.columns = [
    { header: 'Region', key: 'region', width: 24 },
    { header: 'Group', key: 'group', width: 58 },
    { header: 'Cost', key: 'cost', width: 14 },
    { header: 'Usage', key: 'usage', width: 18 },
    { header: 'Currency', key: 'currency', width: 12 },
    { header: 'Cost Share', key: 'percentOfCost', width: 14 },
    { header: 'Rows', key: 'count', width: 10 }
  ];

  for (const row of report.byGroup || []) {
    sheet.addRow({
      region: row.region || 'Unspecified',
      group: row.group || 'All Usage',
      cost: numberValue(row.cost),
      usage: numberValue(row.usage),
      currency: row.currency || '',
      percentOfCost: numberValue(row.percentOfCost),
      count: numberValue(row.count)
    });
  }

  const totals = report.totals || {};
  const totalRow = sheet.addRow({
    group: `Grand Total (${(report.byGroup || []).length} groups)`,
    cost: numberValue(totals.cost),
    usage: numberValue(totals.usage),
    currency: totals.currency || '',
    percentOfCost: numberValue(totals.cost) ? 1 : 0,
    count: numberValue(totals.rowCount)
  });

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  header.alignment = { vertical: 'middle' };

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E0E9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E0E9' } }
      };
      if (rowNumber > 1) cell.alignment = { vertical: 'top' };
    });
  });

  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF5' } };

  sheet.getColumn('cost').numFmt = '$#,##0.00####;-$#,##0.00####';
  sheet.getColumn('usage').numFmt = '#,##0.00';
  sheet.getColumn('percentOfCost').numFmt = '0.0%';
  sheet.getColumn('count').numFmt = '#,##0';
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount - 1), column: sheet.columnCount }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function csvCell(value) {
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (/["\n,]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
