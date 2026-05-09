const form = document.querySelector('#usageForm');
const rowsEl = document.querySelector('#usageRows');
const statusText = document.querySelector('#statusText');
const scanStatus = document.querySelector('#scanStatus');
const totalCost = document.querySelector('#totalCost');
const totalUsage = document.querySelector('#totalUsage');
const rowCount = document.querySelector('#rowCount');
const csvLink = document.querySelector('#csvLink');
const excelDownload = document.querySelector('#excelDownload');
const usageChart = document.querySelector('#usageChart');
const chartNote = document.querySelector('#chartNote');
const dailyHeatMap = document.querySelector('#dailyHeatMap');
const dailyModeButtons = Array.from(document.querySelectorAll('[data-daily-mode]'));
const groupMenu = document.querySelector('#groupMenu');
const groupOptions = document.querySelector('#groupOptions');
const groupSummary = document.querySelector('#groupSummary');
const groupByInput = document.querySelector('#groupByInput');
const tableFilters = document.querySelector('#tableFilters');
const usageTable = document.querySelector('#usageTable');
const resetFilters = document.querySelector('#resetFilters');
const grandTotalLabel = document.querySelector('#grandTotalLabel');
const grandTotalCost = document.querySelector('#grandTotalCost');
const grandTotalUsage = document.querySelector('#grandTotalUsage');
const grandTotalCurrency = document.querySelector('#grandTotalCurrency');
const grandTotalShare = document.querySelector('#grandTotalShare');
const grandTotalRows = document.querySelector('#grandTotalRows');
const insightStatus = document.querySelector('#insightStatus');
const themeSelector = document.querySelector('#themeSelector');
const regionHeatGrid = document.querySelector('#regionHeatGrid');
const serviceRegionMatrix = document.querySelector('#serviceRegionMatrix');
const compartmentChart = document.querySelector('#compartmentChart');
const spendStrip = document.querySelector('#spendStrip');
const waterfallChart = document.querySelector('#waterfallChart');
const scatterChart = document.querySelector('#scatterChart');
const paretoChart = document.querySelector('#paretoChart');
const donutChart = document.querySelector('#donutChart');
const driftChart = document.querySelector('#driftChart');
const serviceSkuChart = document.querySelector('#serviceSkuChart');
const regionLegendSection = document.querySelector('#regionLegendSection');
const regionLegend = document.querySelector('#regionLegend');
const billingSummaryWindow = document.querySelector('#billingSummaryWindow');
const billingSummaryDays = document.querySelector('#billingSummaryDays');
const uniqueSkuCount = document.querySelector('#uniqueSkuCount');
const uniqueSkuDetail = document.querySelector('#uniqueSkuDetail');
const activeRegionCount = document.querySelector('#activeRegionCount');
const activeRegionDetail = document.querySelector('#activeRegionDetail');
const dailyAverageCost = document.querySelector('#dailyAverageCost');
const dailyAverageDetail = document.querySelector('#dailyAverageDetail');
const peakDailyCost = document.querySelector('#peakDailyCost');
const peakDailyDetail = document.querySelector('#peakDailyDetail');
const footerProfile = document.querySelector('#footerProfile');
const footerWindow = document.querySelector('#footerWindow');
const footerLastScan = document.querySelector('#footerLastScan');
const echartsLib = window.echarts;

const chartTotals = {
  usage: document.querySelector('#usageChartTotal'),
  regionHeat: document.querySelector('#regionHeatTotal'),
  waterfall: document.querySelector('#waterfallTotal'),
  matrix: document.querySelector('#matrixTotal'),
  compartment: document.querySelector('#compartmentTotal'),
  scatter: document.querySelector('#scatterTotal'),
  pareto: document.querySelector('#paretoTotal'),
  donut: document.querySelector('#donutTotal'),
  strip: document.querySelector('#stripTotal'),
  serviceSku: document.querySelector('#serviceSkuTotal'),
  drift: document.querySelector('#driftTotal'),
  dailyHeat: document.querySelector('#dailyHeatTotal')
};

const chartElements = {
  usage: usageChart,
  regionHeat: regionHeatGrid,
  waterfall: waterfallChart,
  matrix: serviceRegionMatrix,
  compartment: compartmentChart,
  scatter: scatterChart,
  pareto: paretoChart,
  donut: donutChart,
  strip: spendStrip,
  serviceSku: serviceSkuChart,
  drift: driftChart,
  dailyHeat: dailyHeatMap
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
let groupByOptions = [];
let currentReport;
let currentInsights;
let currentVisibleRows = [];
let currentVisibleTotals;
let currentDailyRows = [];
let currentDailyQuery;
let activeScanId = 0;
let dailyExplorerMode = 'timeline';

const charts = new Map();

const tableColumns = [
  { key: 'region', label: 'Region', value: (row) => row.region || 'Unspecified' },
  { key: 'group', label: 'Group', value: (row) => row.group || 'All Usage' },
  { key: 'cost', label: 'Cost', value: (row) => formatCost(row.cost || 0) },
  { key: 'usage', label: 'Usage', value: (row) => number.format(row.usage || 0) },
  { key: 'currency', label: 'Currency', value: (row) => (row.currency || '').trim() || 'Unspecified' },
  { key: 'percentOfCost', label: 'Cost Share', value: (row) => percent.format(row.percentOfCost || 0) },
  { key: 'count', label: 'Rows', value: (row) => number.format(row.count || 0) }
];

applyTheme(localStorage.getItem('oci-cost-theme') || 'light', false);
loadDefaults().then(loadReport).catch(showError);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  loadReport().catch(showError);
});

form.start.addEventListener('input', clearEndDateWhenStartIsAfterEnd);
form.start.addEventListener('change', clearEndDateWhenStartIsAfterEnd);

themeSelector.addEventListener('change', () => {
  applyTheme(themeSelector.value, true);
});

excelDownload.addEventListener('click', () => {
  downloadExcel().catch(showError);
});

for (const button of document.querySelectorAll('.chart-download')) {
  button.addEventListener('click', () => downloadChart(button.dataset.chart));
}

for (const button of dailyModeButtons) {
  button.addEventListener('click', () => {
    dailyExplorerMode = button.dataset.dailyMode || 'timeline';
    syncDailyModeButtons();
    if (currentDailyQuery) {
      drawDailyCostExplorer(currentDailyRows, currentDailyQuery);
    }
  });
}

syncDailyModeButtons();

tableFilters.addEventListener('click', (event) => {
  const action = event.target.closest('[data-filter-action]');
  if (!action) return;

  event.preventDefault();
  const menu = action.closest('.filter-menu');
  if (!menu) return;
  setFilterSelection(menu, action.dataset.filterAction);
});

tableFilters.addEventListener('input', (event) => {
  if (!event.target.matches('.filter-search')) return;
  const menu = event.target.closest('.filter-menu');
  if (menu) applyFilterSearch(menu);
});

document.addEventListener('click', (event) => {
  if (!groupMenu.contains(event.target)) groupMenu.open = false;
  for (const menu of tableFilters.querySelectorAll('details')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});

resetFilters.addEventListener('click', () => {
  for (const checkbox of tableFilters.querySelectorAll('input[type="checkbox"]')) {
    checkbox.checked = true;
  }
  for (const search of tableFilters.querySelectorAll('.filter-search')) {
    search.value = '';
    const menu = search.closest('.filter-menu');
    if (menu) applyFilterSearch(menu);
  }
  applyTableFilters();
});

tableFilters.addEventListener('pointerdown', beginColumnResize);

window.addEventListener('resize', () => {
  for (const chart of charts.values()) chart.resize();
});

async function loadDefaults() {
  const response = await fetch('/api/defaults');
  if (!response.ok) throw new Error('Unable to load defaults');
  const config = await response.json();
  form.start.value = config.defaults.start;
  form.end.value = config.defaults.end;
  form.granularity.value = config.defaults.granularity;
  form.queryType.value = config.defaults.queryType;
  groupByOptions = config.groupByOptions || [];
  footerProfile.textContent = config.profile || 'DEFAULT';
  updateFooterWindow(config.defaults.start, config.defaults.end);
  updateBillingSummaryWindow(config.defaults.start, config.defaults.end);
  renderGroupByOptions(config.defaults.groupBy);
}

function clearEndDateWhenStartIsAfterEnd() {
  if (form.start.value && form.end.value && form.start.value > form.end.value) {
    form.end.value = '';
  }
}

async function loadReport() {
  const scanId = ++activeScanId;
  setScanState('scanning', 'Scanning');
  statusText.textContent = 'Scanning';
  insightStatus.textContent = 'Scanning charts';
  updateFooterWindow(form.start.value, form.end.value);
  updateBillingSummaryWindow(form.start.value, form.end.value);
  setBillingSummaryPending();
  currentDailyRows = [];
  currentDailyQuery = undefined;
  excelDownload.disabled = true;
  const params = new URLSearchParams(new FormData(form));
  csvLink.href = `/api/usage.csv?${params}`;

  try {
    const report = await fetchReport(params);
    if (!isActiveScan(scanId)) return;
    renderReport(report);
  } catch (error) {
    if (!isActiveScan(scanId)) return;
    throw error;
  }

  try {
    currentInsights = await loadInsightReports(params);
    if (!isActiveScan(scanId)) return;
    renderInsights(currentInsights);
    setScanState('complete', 'Scan complete');
  } catch (error) {
    if (!isActiveScan(scanId)) return;
    currentInsights = undefined;
    insightStatus.textContent = error.message || 'Unable to load charts';
    setBillingSummaryUnavailable();
    drawUnavailableInsightCharts();
    setScanState('complete', 'Scan complete');
  } finally {
    if (isActiveScan(scanId)) excelDownload.disabled = false;
  }
}

function isActiveScan(scanId) {
  return scanId === activeScanId;
}

function drawUnavailableInsightCharts() {
  for (const element of [
    regionHeatGrid,
    waterfallChart,
    serviceRegionMatrix,
    compartmentChart,
    scatterChart,
    paretoChart,
    donutChart,
    spendStrip,
    serviceSkuChart,
    driftChart,
    dailyHeatMap
  ]) {
    drawEmptyChart(element, 'Chart data unavailable.');
  }
}

function drawUnavailableInsightChart(element, key, insights) {
  drawEmptyChart(element, insights.errors?.[key] || 'Chart data unavailable.');
}

async function fetchReport(params) {
  const response = await fetch(`/api/usage?${params}`);
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.detail || body.error || 'Usage request failed');
    error.status = response.status;
    throw error;
  }
  return body;
}

async function fetchReportWithRetry(params) {
  try {
    return await fetchReport(params);
  } catch (error) {
    if (error.status !== 429) throw error;
    await delay(1400);
    return fetchReport(params);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchInsightReport(name, params) {
  try {
    return { name, report: await fetchReportWithRetry(params) };
  } catch (error) {
    return { name, error: error.message || 'Insight query failed' };
  }
}

async function loadInsightReports(params) {
  const serviceParams = new URLSearchParams(params);
  serviceParams.set('queryType', 'COST');
  serviceParams.set('groupBy', 'service');

  const skuParams = new URLSearchParams(params);
  skuParams.set('queryType', 'COST');
  skuParams.set('groupBy', 'service,skuPartNumber,skuName');

  const compartmentParams = new URLSearchParams(params);
  compartmentParams.set('queryType', 'COST');
  compartmentParams.set('groupBy', 'compartmentPath');
  if (!compartmentParams.get('compartmentDepth')) {
    compartmentParams.set('compartmentDepth', '5');
  }

  const driftParams = new URLSearchParams(params);
  const driftWindow = driftWindowFor(String(params.get('end') || form.end.value));
  driftParams.set('start', driftWindow.start);
  driftParams.set('end', driftWindow.end);
  driftParams.set('granularity', 'MONTHLY');
  driftParams.set('queryType', 'COST');
  driftParams.set('groupBy', 'service');
  driftParams.set('includeRows', 'true');

  const dailyParams = new URLSearchParams(params);
  dailyParams.set('granularity', 'DAILY');
  dailyParams.set('queryType', 'COST');
  dailyParams.set('groupBy', 'service');
  dailyParams.set('includeRows', 'true');

  const results = [
    await fetchInsightReport('service', serviceParams),
    await fetchInsightReport('sku', skuParams),
    await fetchInsightReport('compartment', compartmentParams),
    await fetchInsightReport('drift', driftParams),
    await fetchInsightReport('daily', dailyParams)
  ];

  const insights = { errors: {} };
  for (const result of results) {
    if (result.report) {
      insights[result.name] = result.report;
    } else {
      insights.errors[result.name] = result.error;
    }
  }

  return insights;
}

function renderReport(report) {
  currentReport = report;
  updateFooterWindow(report.query.start, report.query.end);
  updateBillingSummaryWindow(report.query.start, report.query.end);
  updateFooterLastScan(report.generatedAt);
  renderRegionLegend(report.byGroup || []);
  renderTableFilters(report);
  applyTableFilters();
}

function renderVisibleRows(rows, totals) {
  currentVisibleRows = rows;
  currentVisibleTotals = totals;
  totalCost.textContent = formatCost(totals.cost || 0);
  totalUsage.textContent = number.format(totals.usage || 0);
  rowCount.textContent = number.format(totals.rowCount || 0);
  rowsEl.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.className = 'empty-table-row';
    tr.innerHTML = `
      <td colspan="${tableColumns.length}">
        ${escapeHtml(emptyGroupedUsageMessage(currentReport))}
      </td>
    `;
    rowsEl.appendChild(tr);
  }

  for (const row of rows.slice(0, 200)) {
    const tr = document.createElement('tr');
    const region = row.region || 'Unspecified';
    const costShare = totals.cost ? row.cost / totals.cost : 0;
    tr.className = 'region-row';
    tr.style.setProperty('--region-color', regionSeriesColor(region));
    tr.style.setProperty('--region-bg', regionColor(region, 82, 94, 0.58));
    tr.style.setProperty('--region-bg-strong', regionColor(region, 78, 90, 0.9));
    tr.innerHTML = `
      <td><span class="region-chip">${escapeHtml(region)}</span></td>
      <td>${escapeHtml(row.group)}</td>
      <td>${formatCost(row.cost || 0)}</td>
      <td>${number.format(row.usage || 0)}</td>
      <td>${escapeHtml(row.currency || '')}</td>
      <td>${percent.format(costShare)}</td>
      <td>${number.format(row.count || 0)}</td>
    `;
    rowsEl.appendChild(tr);
  }

  grandTotalLabel.textContent = `Grand Total (${number.format(rows.length)} groups)`;
  grandTotalCost.textContent = formatCost(totals.cost || 0);
  grandTotalUsage.textContent = number.format(totals.usage || 0);
  grandTotalCurrency.textContent = totals.currency;
  grandTotalShare.textContent = totals.cost ? percent.format(1) : percent.format(0);
  grandTotalRows.textContent = number.format(totals.rowCount || 0);

  const viewReport = { ...currentReport, totals };
  setChartTotal('usage', totals.cost || 0);
  statusText.textContent = statusFor(rows.length ? viewReport : currentReport, rows.length, currentReport.byGroup.length);

  if (!rows.length) {
    const message = emptyGroupedUsageMessage(currentReport);
    drawEmptyChart(usageChart, message);
    chartNote.textContent = message;
    return;
  }

  const metric = selectChartMetric(viewReport, rows);
  drawGroupedUsageChart(rows.slice(0, 12), metric);
  chartNote.textContent = metric.note;
}

function renderInsights(insights) {
  const serviceRows = insights.service?.byGroup || [];
  const skuRows = insights.sku?.byGroup || [];
  const compartmentRows = insights.compartment?.byGroup || [];
  renderBillingPeriodSummary(insights);

  if (insights.service) {
    drawRegionHeatGrid(serviceRows);
    drawServiceRegionMatrix(serviceRows);
    drawCostDonut(serviceRows);
    setChartTotal('regionHeat', sumCost(serviceRows));
    setChartTotal('matrix', sumCost(serviceRows));
    setChartTotal('donut', sumCost(serviceRows.filter((row) => row.cost > 0)));
  } else {
    drawUnavailableInsightChart(regionHeatGrid, 'service', insights);
    drawUnavailableInsightChart(serviceRegionMatrix, 'service', insights);
    drawUnavailableInsightChart(donutChart, 'service', insights);
    setChartTotal('regionHeat', 0);
    setChartTotal('matrix', 0);
    setChartTotal('donut', 0);
  }

  if (insights.sku) {
    drawWaterfallChart(skuRows);
    drawUnitEconomicsScatter(skuRows);
    drawSkuPareto(skuRows);
    drawSpendWordCloud(skuRows);
    drawServiceSkuDescriptionTree(skuRows);
    setChartTotal('waterfall', sumCost(skuRows));
    setChartTotal('scatter', sumCost(skuRows.filter((row) => row.cost > 0 && row.usage > 0)));
    setChartTotal('pareto', sumCost(skuRows.filter((row) => row.cost > 0)));
    setChartTotal('strip', sumCost(skuRows.filter((row) => row.cost > 0)));
    setChartTotal('serviceSku', sumCost(skuRows.filter((row) => row.cost > 0)));
  } else {
    drawUnavailableInsightChart(waterfallChart, 'sku', insights);
    drawUnavailableInsightChart(scatterChart, 'sku', insights);
    drawUnavailableInsightChart(paretoChart, 'sku', insights);
    drawUnavailableInsightChart(spendStrip, 'sku', insights);
    drawUnavailableInsightChart(serviceSkuChart, 'sku', insights);
    setChartTotal('waterfall', 0);
    setChartTotal('scatter', 0);
    setChartTotal('pareto', 0);
    setChartTotal('strip', 0);
    setChartTotal('serviceSku', 0);
  }

  if (insights.compartment) {
    drawCompartmentCostChart(compartmentRows, insights.compartment.query);
    setChartTotal('compartment', sumCost(compartmentRows));
  } else {
    drawUnavailableInsightChart(compartmentChart, 'compartment', insights);
    setChartTotal('compartment', 0);
  }

  if (insights.drift) {
    drawRegionDrift(insights.drift.rows || [], insights.drift.query);
    setChartTotal('drift', sumRawCost(insights.drift.rows || []));
  } else {
    drawUnavailableInsightChart(driftChart, 'drift', insights);
    setChartTotal('drift', 0);
  }

  if (insights.daily) {
    currentDailyRows = insights.daily.rows || [];
    currentDailyQuery = insights.daily.query;
    drawDailyCostExplorer(currentDailyRows, currentDailyQuery);
  } else {
    currentDailyRows = [];
    currentDailyQuery = undefined;
    drawUnavailableInsightChart(dailyHeatMap, 'daily', insights);
    setChartTotal('dailyHeat', 0);
  }

  const costRows = skuRows.filter((row) => row.cost !== 0).length;
  const failed = Object.keys(insights.errors || {});
  const zeroCostSource = insights.service || insights.sku;
  if (!costRows && zeroCostSource?.totals?.rowCount) {
    insightStatus.textContent = `${emptyCostWindowMessage(zeroCostSource)}; ${failed.length ? `${failed.length} chart source${failed.length === 1 ? '' : 's'} unavailable` : 'charts intentionally empty'}`;
  } else {
    insightStatus.textContent = failed.length
      ? `${number.format(costRows)} non-zero cost groups analyzed; ${failed.length} chart source${failed.length === 1 ? '' : 's'} unavailable`
      : `${number.format(costRows)} non-zero cost groups analyzed`;
  }
}

function renderBillingPeriodSummary(insights) {
  const skuRows = (insights.sku?.byGroup || []).filter((row) => row.cost !== 0);
  const skuTotals = aggregateRows(skuRows, skuNameForRow)
    .filter((row) => row.key && row.key !== 'Unspecified')
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
  const serviceRows = (insights.service?.byGroup || []).filter((row) => row.cost !== 0);
  const regionTotals = aggregateRows(serviceRows, (row) => row.region || 'Unspecified')
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
  const dailySeries = insights.daily ? dailyCostSeries(insights.daily.rows || [], insights.daily.query) : [];
  const totalDailyCost = dailySeries.reduce((sum, row) => sum + row.cost, 0);
  const averageDailyCost = dailySeries.length ? totalDailyCost / dailySeries.length : 0;
  const peakDay = dailySeries
    .slice()
    .filter((row) => row.cost !== 0)
    .sort((a, b) => b.cost - a.cost)[0];

  uniqueSkuCount.textContent = insights.sku ? number.format(skuTotals.length) : '0';
  uniqueSkuDetail.textContent = insights.sku
    ? skuTotals.length
      ? `Top: ${truncate(skuTotals[0].key, 34)}`
      : 'No SKU data'
    : 'SKU scan unavailable';
  activeRegionCount.textContent = insights.service ? number.format(regionTotals.length) : '0';
  activeRegionDetail.textContent = insights.service
    ? regionTotals.length
      ? regionTotals.slice(0, 3).map((row) => row.key).join(', ')
      : 'No active regions'
    : 'Region scan unavailable';
  dailyAverageCost.textContent = insights.daily ? formatCost(averageDailyCost) : '$0.00';
  dailyAverageDetail.textContent = insights.daily ? `${number.format(dailySeries.length)} days analyzed` : 'Daily scan unavailable';
  peakDailyCost.textContent = insights.daily ? formatCost(peakDay?.cost || 0) : '$0.00';
  peakDailyDetail.textContent = insights.daily
    ? peakDay
      ? peakDay.day
      : 'No daily cost'
    : 'Peak scan unavailable';
}

function drawGroupedUsageChart(rows, metric) {
  const chart = chartFor(usageChart);
  if (!rows.length) {
    drawEmptyChart(usageChart, 'No usage returned for this query.');
    return;
  }

  const values = rows.map((row) => metric.value(row));
  chart.setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (items) => {
        const item = items[0];
        const row = rows[item.dataIndex];
        return tooltipLines(row.group, [
          ['Region', row.region || 'Unspecified'],
          ['Cost', formatCost(row.cost || 0)],
          ['Usage', number.format(row.usage || 0)],
          ['Rows', number.format(row.count || 0)]
        ]);
      }
    },
    grid: { left: 220, right: 92, top: 16, bottom: 28 },
    xAxis: valueAxis({ formatter: formatAxisCost, min: Math.min(0, ...values), max: Math.max(0, ...values) }),
    yAxis: categoryAxis(rows.map((row) => row.group || 'All Usage'), { inverse: true, width: 200 }),
    dataZoom: rows.length > 8 ? [{ type: 'inside', yAxisIndex: 0 }] : [],
    series: [{
      type: 'bar',
      data: rows.map((row) => ({
        value: metric.value(row),
        itemStyle: {
          color: categorySeriesColor(row.group || row.region || 'All Usage', 0.9),
          borderColor: metric.value(row) < 0 ? '#8b3a3a' : 'transparent',
          borderWidth: metric.value(row) < 0 ? 1 : 0
        }
      })),
      barMaxWidth: 24,
      label: {
        show: true,
        position: 'right',
        color: colorVar('--ink'),
        formatter: ({ value }) => metric.format(value)
      }
    }]
  }, true);
}

function drawRegionHeatGrid(rows) {
  const regions = aggregateRows(rows, (row) => row.region || 'Unspecified')
    .filter((row) => row.cost !== 0)
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
  if (!regions.length) {
    drawEmptyChart(regionHeatGrid, 'No non-zero regional cost for this window.');
    return;
  }

  chartFor(regionHeatGrid).setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      formatter: ({ data }) => tooltipLines(data.name, [
        ['Cost', formatCost(data.rawCost)],
        ['Rows', number.format(data.count)]
      ])
    },
    series: [{
      type: 'treemap',
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: { color: colorVar('--ink'), formatter: ({ name }) => name },
      upperLabel: { show: false },
      itemStyle: { borderColor: colorVar('--panel'), borderWidth: 3, gapWidth: 3 },
      data: regions.map((row) => ({
        name: row.key,
        value: Math.abs(row.cost),
        rawCost: row.cost,
        count: row.count,
        itemStyle: { color: regionSeriesColor(row.key) }
      }))
    }]
  }, true);
}

function drawWaterfallChart(rows) {
  const top = topRowsByMagnitude(rows, 8);
  if (!top.length) {
    drawEmptyChart(waterfallChart, 'No cost drivers to show.');
    return;
  }

  let cumulative = 0;
  const baseData = [];
  const deltaData = [];
  for (const row of top) {
    const cost = row.cost || 0;
    baseData.push(cost >= 0 ? cumulative : cumulative + cost);
    deltaData.push({
      value: Math.abs(cost),
      rawCost: cost,
      cumulative: cumulative + cost,
      itemStyle: {
        color: categorySeriesColor(row.group || row.region || 'Cost driver', 0.9),
        borderColor: cost < 0 ? '#8b3a3a' : 'transparent',
        borderWidth: cost < 0 ? 1 : 0
      }
    });
    cumulative += cost;
  }

  chartFor(waterfallChart).setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      trigger: 'axis',
      formatter: (items) => {
        const item = items.find((entry) => entry.seriesName === 'Cost driver');
        const row = top[item.dataIndex];
        return tooltipLines(row.group, [
          ['Region', row.region || 'Unspecified'],
          ['Cost', formatCost(item.data.rawCost)],
          ['Cumulative', formatCost(item.data.cumulative)]
        ]);
      }
    },
    grid: { left: 190, right: 76, top: 16, bottom: 28 },
    xAxis: valueAxis({ formatter: formatAxisCost }),
    yAxis: categoryAxis(top.map((row) => row.group), { inverse: true, width: 170 }),
    series: [
      {
        name: 'Base',
        type: 'bar',
        stack: 'total',
        silent: true,
        itemStyle: { color: 'transparent', borderColor: 'transparent' },
        emphasis: { disabled: true },
        data: baseData
      },
      {
        name: 'Cost driver',
        type: 'bar',
        stack: 'total',
        data: deltaData,
        barMaxWidth: 22,
        label: {
          show: true,
          position: 'right',
          color: colorVar('--ink'),
          formatter: ({ data }) => formatCost(data.rawCost)
        }
      }
    ]
  }, true);
}

function drawServiceRegionMatrix(rows) {
  const matrixRows = rows.filter((row) => row.cost !== 0);
  if (!matrixRows.length) {
    drawEmptyChart(serviceRegionMatrix, 'No service-region cost to show.');
    return;
  }

  const regions = aggregateRows(matrixRows, (row) => row.region || 'Unspecified')
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost))
    .slice(0, 10)
    .map((row) => row.key);
  const services = aggregateRows(matrixRows, (row) => row.group || 'All Usage')
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost))
    .slice(0, 12)
    .map((row) => row.key);
  const lookup = new Map(matrixRows.map((row) => [`${row.group}@@${row.region}`, row.cost]));
  const cells = [];
  for (const [serviceIndex, service] of services.entries()) {
    for (const [regionIndex, region] of regions.entries()) {
      const cost = lookup.get(`${service}@@${region}`) || 0;
      if (cost) cells.push({ regionIndex, serviceIndex, service, region, cost, magnitude: Math.abs(cost) });
    }
  }
  const maxMagnitude = Math.max(...cells.map((item) => item.magnitude), 1);
  const data = cells.map((item) => ({
    value: [item.regionIndex, item.serviceIndex, item.magnitude, item.cost],
    itemStyle: { color: categorySeriesColor(item.service, 0.35 + 0.58 * (item.magnitude / maxMagnitude)) }
  }));

  chartFor(serviceRegionMatrix).setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      formatter: ({ data: item }) => tooltipLines(services[item.value[1]], [
        ['Region', regions[item.value[0]]],
        ['Cost', formatCost(item.value[3])]
      ])
    },
    grid: { left: 230, right: 40, top: 34, bottom: 54 },
    xAxis: categoryAxis(regions, { axisLabelRotate: 0 }),
    yAxis: categoryAxis(services, { inverse: true, width: 210 }),
    visualMap: { show: false, min: 0, max: maxMagnitude },
    series: [{
      type: 'heatmap',
      data,
      label: {
        show: true,
        color: colorVar('--ink'),
        formatter: ({ data: item }) => formatCost(item.value[3])
      },
      emphasis: { itemStyle: { borderColor: colorVar('--ink'), borderWidth: 1 } }
    }]
  }, true);
}

function drawCompartmentCostChart(rows, query = {}) {
  const compartments = aggregateCompartmentRows(rows.filter((row) => row.cost !== 0))
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost) || a.path.localeCompare(b.path));
  if (!compartments.length) {
    drawEmptyChart(compartmentChart, 'No compartment cost to show.');
    return;
  }

  const topLimit = 12;
  const chartRows = compartments.slice(0, topLimit);
  const remaining = compartments.slice(topLimit);
  if (remaining.length) {
    const other = mergeCompartmentAggregates('Other compartments', remaining);
    if (Math.abs(other.cost) > 0.000001) chartRows.push(other);
  }

  const totalMagnitude = chartRows.reduce((sum, row) => sum + Math.abs(row.cost || 0), 0) || 1;
  const regionTotals = new Map();
  for (const row of chartRows) {
    for (const [region, cost] of row.regionCosts.entries()) {
      regionTotals.set(region, (regionTotals.get(region) || 0) + Math.abs(cost || 0));
    }
  }
  const regions = Array.from(regionTotals.entries())
    .filter(([, cost]) => cost > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([region]) => region);
  const labels = chartRows.map((row) => displayCompartmentPath(row.path));
  const depthText = compartmentDepthDescription(query);
  const legendTop = regions.length > 1 ? 8 : 0;

  chartFor(compartmentChart).setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (items) => {
        const row = items.find((item) => item.data?.compartment)?.data.compartment;
        if (!row) return '';
        const regionLines = Array.from(row.regionCosts.entries())
          .filter(([, cost]) => Math.abs(cost || 0) > 0.000001)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
          .slice(0, 5)
          .map(([region, cost]) => [`${region} cost`, formatCost(cost)]);
        return tooltipLines(displayCompartmentPath(row.path), [
          ['Net cost', formatCost(row.cost || 0)],
          ['Share of shown cost', percent.format(Math.abs(row.cost || 0) / totalMagnitude)],
          ['Usage', number.format(row.usage || 0)],
          ['Rows', number.format(row.count || 0)],
          ['Dominant region', row.dominantRegion || 'Unspecified'],
          ['Selected depth', depthText],
          ...regionLines
        ]);
      }
    },
    legend: {
      show: regions.length > 1,
      data: regions,
      type: 'scroll',
      top: legendTop,
      right: 8,
      textStyle: { color: colorVar('--ink'), fontWeight: 700 }
    },
    grid: { left: 260, right: 112, top: regions.length > 1 ? 46 : 20, bottom: 42 },
    xAxis: valueAxis({ formatter: formatAxisCost }),
    yAxis: categoryAxis(labels, { inverse: true, width: 238 }),
    dataZoom: chartRows.length > 8 ? [{ type: 'inside', yAxisIndex: 0 }] : [],
    graphic: {
      type: 'text',
      right: 18,
      bottom: 8,
      style: {
        text: `${depthText}; showing ${number.format(chartRows.length)} of ${number.format(compartments.length)} compartment groups`,
        fill: colorVar('--muted'),
        font: '800 11px Inter, system-ui, sans-serif',
        textAlign: 'right'
      }
    },
    series: [
      ...regions.map((region) => ({
        name: region,
        type: 'bar',
        stack: 'compartment-cost',
        data: chartRows.map((row) => ({
          value: row.regionCosts.get(region) || 0,
          compartment: row,
          itemStyle: {
            color: regionSeriesColor(region, 0.86),
            borderColor: colorVar('--panel'),
            borderWidth: 1
          }
        })),
        barMaxWidth: 24,
        emphasis: { focus: 'series' }
      })),
      {
        name: 'Net cost label',
        type: 'scatter',
        symbolSize: 0,
        silent: true,
        data: chartRows.map((row) => ({
          value: [row.cost || 0, displayCompartmentPath(row.path)],
          totalCost: row.cost || 0
        })),
        label: {
          show: true,
          position: 'right',
          color: colorVar('--ink'),
          fontWeight: 900,
          formatter: ({ data }) => formatCost(data.totalCost || 0)
        },
        tooltip: { show: false }
      }
    ]
  }, true);
}

function drawUnitEconomicsScatter(rows) {
  const points = rows.filter((row) => row.cost > 0 && row.usage > 0);
  if (!points.length) {
    drawEmptyChart(scatterChart, 'No cost and usage pairs to show.');
    return;
  }

  chartFor(scatterChart).setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      formatter: ({ data }) => {
        const value = data.value || data;
        return tooltipLines(value[3], [
          ['Region', value[4]],
          ['Cost', formatCost(value[1])],
          ['Usage', number.format(value[0])],
          ['Rows', number.format(value[2])]
        ]);
      }
    },
    grid: { left: 54, right: 22, top: 18, bottom: 42 },
    xAxis: valueAxis({ name: 'Usage', type: 'log', formatter: formatAxisNumber }),
    yAxis: valueAxis({ name: 'Cost', type: 'log', formatter: formatAxisCost }),
    series: [{
      type: 'scatter',
      data: points.map((row) => ({
        value: [row.usage, row.cost, row.count || 1, row.group, row.region || 'Unspecified'],
        itemStyle: { color: categorySeriesColor(row.group || row.region || 'Usage point', 0.84) }
      })),
      symbolSize: (item) => Math.min(24, 6 + Math.sqrt(item[2] || 1) * 2),
      emphasis: { focus: 'series' }
    }]
  }, true);
}

function drawSkuPareto(rows) {
  const top = topRows(rows, 10);
  if (!top.length) {
    drawEmptyChart(paretoChart, 'No SKU cost to show.');
    return;
  }

  const total = rows.filter((row) => row.cost > 0).reduce((sum, row) => sum + row.cost, 0) || 1;
  let cumulative = 0;
  const cumulativePct = top.map((row) => {
    cumulative += row.cost;
    return cumulative / total;
  });

  chartFor(paretoChart).setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      trigger: 'axis',
      formatter: (items) => {
        const index = items[0].dataIndex;
        return tooltipLines(top[index].group, [
          ['Region', top[index].region || 'Unspecified'],
          ['Cost', formatCost(top[index].cost)],
          ['Cumulative', percent.format(cumulativePct[index])]
        ]);
      }
    },
    legend: { show: false },
    grid: { left: 58, right: 28, top: 38, bottom: 42 },
    xAxis: {
      ...categoryAxis(top.map((_, index) => String(index + 1))),
      axisLabel: {
        color: colorVar('--muted'),
        fontWeight: 900
      }
    },
    yAxis: [
      {
        ...valueAxis({ formatter: formatAxisCost }),
        name: 'Cost',
        splitNumber: 4,
        splitLine: {
          show: true,
          lineStyle: { color: colorWithAlpha(colorVar('--line'), 0.72) }
        }
      },
      {
        type: 'value',
        min: 0,
        max: 1,
        show: false,
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false }
      }
    ],
    series: [
      {
        name: 'Cost',
        type: 'bar',
        data: top.map((row) => ({ value: row.cost, itemStyle: { color: categorySeriesColor(row.group || row.region || 'SKU', 0.9) } })),
        barMaxWidth: 30
      },
      {
        name: 'Cumulative',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: cumulativePct.map((value, index) => ({
          value,
          label: {
            show: index === cumulativePct.length - 1 || value >= 0.8 && (cumulativePct[index - 1] || 0) < 0.8,
            formatter: percent.format(value),
            color: colorVar('--brand'),
            backgroundColor: colorVar('--panel'),
            borderColor: colorWithAlpha(colorVar('--brand'), 0.24),
            borderRadius: 5,
            borderWidth: 1,
            fontWeight: 900,
            fontSize: 11,
            padding: [3, 6],
            position: 'top',
            distance: 13
          }
        })),
        lineStyle: { color: colorVar('--brand'), width: 3 },
        itemStyle: { color: colorVar('--brand'), borderColor: colorVar('--panel'), borderWidth: 2 },
        areaStyle: { color: colorWithAlpha(colorVar('--brand'), 0.08) },
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: { color: colorVar('--muted'), type: 'dashed', width: 1.5 },
          label: {
            formatter: '80%',
            color: colorVar('--muted'),
            backgroundColor: colorVar('--panel'),
            borderColor: colorWithAlpha(colorVar('--muted'), 0.24),
            borderRadius: 5,
            borderWidth: 1,
            fontWeight: 900,
            padding: [3, 6],
            position: 'insideStartTop'
          },
          data: [{ yAxis: 0.8 }]
        }
      }
    ]
  }, true);
}

function drawCostDonut(rows) {
  const services = aggregateRowsWithDominantRegion(rows.filter((row) => row.cost > 0), (row) => row.group || 'All Usage')
    .sort((a, b) => b.cost - a.cost);
  if (!services.length) {
    drawEmptyChart(donutChart, 'No positive service cost to show.');
    return;
  }

  const top = services.slice(0, 6);
  const remainingServices = services.slice(6);
  const otherCost = remainingServices.reduce((sum, row) => sum + row.cost, 0);
  if (otherCost > 0) {
    top.push({ key: 'Other', cost: otherCost, count: 0, usage: 0, region: dominantRegion(remainingServices) });
  }
  const total = top.reduce((sum, row) => sum + row.cost, 0);

  chartFor(donutChart).setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      trigger: 'item',
      formatter: ({ name, value, percent: share }) => tooltipLines(name, [
        ['Cost', formatCost(value)],
        ['Share', `${share.toFixed(1)}%`],
        ['Dominant region', top.find((row) => row.key === name)?.region || 'Unspecified']
      ])
    },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['42%', '64%'],
      center: ['50%', '54%'],
      avoidLabelOverlap: true,
      label: {
        show: true,
        alignTo: 'edge',
        edgeDistance: 24,
        bleedMargin: 12,
        formatter: ({ name, percent: share }) => `${wrapChartLabel(name, donutChart.clientWidth > 900 ? 24 : 18)}\n${share.toFixed(1)}%`,
        color: colorVar('--ink'),
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 15
      },
      labelLine: {
        length: 18,
        length2: 28,
        maxSurfaceAngle: 80,
        lineStyle: { width: 1.4 }
      },
      data: top.map((row) => ({ name: row.key, value: row.cost, itemStyle: { color: categorySeriesColor(row.key, 0.92) } }))
    }],
    graphic: [{
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: formatCost(total),
        fill: colorVar('--ink'),
        fontSize: 14,
        fontWeight: 800,
        textAlign: 'center'
      }
    }]
  }, true);
}

function drawSpendWordCloud(rows) {
  const words = spendCloudWords(rows);
  if (!words.length) {
    drawEmptyChart(spendStrip, 'No SKU spend to show.');
    return;
  }

  const total = rows.filter((row) => row.cost > 0).reduce((sum, row) => sum + row.cost, 0) || 1;

  chartFor(spendStrip).setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      trigger: 'item',
      formatter: ({ data, info }) => spendCloudTooltip(info || data, total)
    },
    graphic: {
      type: 'text',
      right: 18,
      bottom: 8,
      style: {
        text: `Cost-weighted SKU cloud; ${number.format(words.length)} labels shown`,
        fill: colorVar('--muted'),
        font: '800 11px Inter, system-ui, sans-serif',
        textAlign: 'right'
      }
    },
    series: [{
      type: 'custom',
      coordinateSystem: 'none',
      data: [words],
      renderItem: (params, api) => renderSpendCloudItem(params, api, words),
      emphasis: { focus: 'self' }
    }]
  }, true);
}

function spendCloudWords(rows) {
  const sorted = rows
    .filter((row) => (row.cost || 0) > 0)
    .slice()
    .sort((a, b) => b.cost - a.cost || b.usage - a.usage);
  const limit = 30;
  const shown = sorted.slice(0, limit).map((row, index) => ({
    kind: 'sku',
    label: spendCloudLabel(row),
    title: row.group || spendCloudLabel(row),
    service: valueFromGroup(row, 'service') || 'Unspecified service',
    sku: valueFromGroup(row, 'skuPartNumber') || valueFromGroup(row, 'skuName') || spendCloudLabel(row),
    description: valueFromGroup(row, 'skuName') || row.group || 'Unspecified description',
    rawGroup: row.group || '',
    cost: row.cost || 0,
    usage: row.usage || 0,
    count: row.count || 0,
    region: row.region || 'Unspecified',
    rank: index + 1,
    colorKey: row.group || row.region || `SKU ${index + 1}`
  }));

  const remaining = sorted.slice(limit);
  const remainingCost = remaining.reduce((sum, row) => sum + (row.cost || 0), 0);
  if (remainingCost > 0.005) {
    shown.push({
      kind: 'tail',
      label: 'Other SKUs',
      title: 'Other SKUs',
      service: 'Mixed services',
      sku: 'Long tail',
      description: `${number.format(remaining.length)} smaller SKU groups`,
      rawGroup: 'Other SKUs',
      cost: remainingCost,
      usage: remaining.reduce((sum, row) => sum + (row.usage || 0), 0),
      count: remaining.reduce((sum, row) => sum + (row.count || 0), 0),
      region: dominantRegion(remaining),
      rank: shown.length + 1,
      colorKey: 'Other SKUs'
    });
  }

  return shown;
}

function spendCloudLabel(row) {
  const sku = valueFromGroup(row, 'skuPartNumber');
  if (sku) return sku;
  const name = valueFromGroup(row, 'skuName');
  if (name) return name;
  return String(row.group || 'Unspecified SKU').split(' | ').filter(Boolean).pop() || 'Unspecified SKU';
}

function renderSpendCloudItem(params, api, words) {
  const width = api.getWidth();
  const height = api.getHeight();
  const layout = layoutSpendCloudWords(words, width, height);
  const children = [
    {
      type: 'rect',
      shape: { x: 14, y: 12, width: Math.max(20, width - 28), height: Math.max(20, height - 44), r: 12 },
      style: {
        fill: colorWithAlpha(colorVar('--line'), 0.18),
        stroke: colorWithAlpha(colorVar('--line'), 0.55),
        lineWidth: 1
      },
      silent: true
    }
  ];

  for (const item of layout) {
    const fill = categorySeriesColor(item.colorKey, item.rank <= 8 ? 0.96 : 0.76);
    const label = truncate(item.label, item.maxChars);
    const isMajor = item.rank <= 8;
    const fontWeight = isMajor ? 900 : 820;
    children.push(
      {
        type: 'rect',
        info: item,
        invisible: true,
        silent: false,
        shape: {
          x: item.x - 8,
          y: item.y - item.boxHeight / 2,
          width: item.boxWidth + 16,
          height: item.boxHeight,
          r: 8
        },
        style: { fill: 'rgba(0,0,0,0)' }
      },
      {
        type: 'circle',
        info: item,
        shape: { cx: item.x - 11, cy: item.y + 1, r: Math.max(2.5, Math.min(5.5, item.fontSize / 7)) },
        style: { fill, opacity: isMajor ? 0.95 : 0.68 }
      },
      {
        type: 'text',
        info: item,
        style: {
          x: item.x,
          y: item.y,
          text: label,
          fill,
          font: `${fontWeight} ${item.fontSize}px Inter, system-ui, sans-serif`,
          textAlign: 'left',
          textVerticalAlign: 'middle'
        }
      }
    );
  }

  return { type: 'group', children: children.filter(Boolean) };
}

function layoutSpendCloudWords(words, width, height) {
  const plot = {
    left: 34,
    top: 24,
    right: Math.max(34, width - 34),
    bottom: Math.max(46, height - 44)
  };
  const plotWidth = Math.max(120, plot.right - plot.left);
  const plotHeight = Math.max(120, plot.bottom - plot.top);
  const maxCost = Math.max(...words.map((word) => word.cost || 0), 1);
  const minFont = width < 760 ? 11 : 12;
  const maxFont = width < 760 ? 22 : 28;
  const rowCount = Math.max(3, Math.min(6, Math.floor(plotHeight / 36)));
  const rows = Array.from({ length: rowCount }, () => ({ width: 0, items: [] }));
  const rowOrder = cloudRowOrder(rowCount);

  for (const [index, word] of words.entries()) {
    const weight = Math.pow((word.cost || 0) / maxCost, 0.42);
    const fontSize = Math.round(minFont + weight * (maxFont - minFont));
    const maxWidthShare = index < 4 ? 0.26 : index < 10 ? 0.2 : 0.16;
    const maxChars = Math.max(8, Math.floor((plotWidth * maxWidthShare) / (fontSize * 0.6)));
    const label = truncate(word.label, maxChars);
    const boxWidth = Math.min(plotWidth - 18, Math.max(36, label.length * fontSize * 0.62 + 24));
    const boxHeight = Math.max(20, fontSize * 1.35);
    const item = {
      ...word,
      fontSize,
      maxChars,
      boxWidth,
      boxHeight
    };

    const row = bestCloudRow(rows, rowOrder, boxWidth, plotWidth);
    row.items.push(item);
    row.width += boxWidth + cloudGapFor(item);
  }

  const positioned = [];
  const rowHeight = plotHeight / rowCount;
  for (const [rowIndex, row] of rows.entries()) {
    if (!row.items.length) continue;
    const contentWidth = row.items.reduce((sum, item, index) => sum + item.boxWidth + (index ? cloudGapFor(item) : 0), 0);
    let x = plot.left + Math.max(0, (plotWidth - contentWidth) / 2);
    const y = plot.top + rowHeight * (rowIndex + 0.5);
    for (const item of row.items) {
      const rect = {
        x,
        y: y - item.boxHeight / 2,
        width: item.boxWidth,
        height: item.boxHeight
      };
      positioned.push({ ...item, x: x + 13, y, rect });
      x += item.boxWidth + cloudGapFor(item);
    }
  }

  return positioned;
}

function cloudRowOrder(rowCount) {
  const center = Math.floor((rowCount - 1) / 2);
  const order = [center];
  for (let offset = 1; order.length < rowCount; offset += 1) {
    if (center - offset >= 0) order.push(center - offset);
    if (center + offset < rowCount) order.push(center + offset);
  }
  return order;
}

function bestCloudRow(rows, rowOrder, boxWidth, plotWidth) {
  const gap = 18;
  const orderedRows = rowOrder.map((index) => rows[index]);
  const fitting = orderedRows.filter((row) => row.width + boxWidth + gap <= plotWidth);
  return (fitting.length ? fitting : orderedRows)
    .sort((a, b) => a.width - b.width)[0];
}

function cloudGapFor(item) {
  return item.rank <= 8 ? 22 : 16;
}

function spendCloudTooltip(item, total) {
  if (!item) return '';
  return tooltipLines(item.title || item.label || 'SKU', [
    ['Service', item.service || 'Mixed'],
    ['SKU', item.sku || item.label || 'Unspecified'],
    ['Description', item.description || 'Unspecified'],
    ['Cost', formatCost(item.cost || 0)],
    ['Share', percent.format((item.cost || 0) / total)],
    ['Usage', number.format(item.usage || 0)],
    ['Rows', number.format(item.count || 0)],
    ['Dominant region', item.region || 'Unspecified'],
    ['Rank', item.rank ? `#${number.format(item.rank)}` : 'n/a']
  ]);
}

function drawServiceSkuDescriptionTree(rows) {
  const tree = serviceSkuTree(rows);
  if (!tree.length) {
    drawEmptyChart(serviceSkuChart, 'No service/SKU cost to show.');
    return;
  }

  const cards = serviceSkuCards(tree);
  const total = tree.reduce((sum, row) => sum + row.rawCost, 0) || 1;
  const maxCost = Math.max(...cards.map((card) => card.rawCost || 0), 1);
  chartFor(serviceSkuChart).setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      trigger: 'item',
      formatter: ({ data, info }) => serviceSkuCardTooltip(info || data, total)
    },
    graphic: {
      type: 'text',
      right: 18,
      bottom: 8,
      style: {
        text: 'Top services with nested top SKUs; smaller items are grouped as Other',
        fill: colorVar('--muted'),
        font: '800 11px Inter, system-ui, sans-serif',
        textAlign: 'right'
      }
    },
    series: [{
      type: 'custom',
      coordinateSystem: 'none',
      data: cards,
      renderItem: (params, api) => renderServiceSkuCardItem(params, api, cards, maxCost),
      emphasis: { focus: 'self' }
    }]
  }, true);
}

function drawRegionDrift(rows, query) {
  const costRows = rows
    .map((row) => ({
      month: String(row.timeUsageStarted || '').slice(0, 7),
      region: row.region || 'Unspecified',
      cost: rawCost(row)
    }))
    .filter((row) => row.month && row.cost !== 0);
  if (!costRows.length) {
    drawEmptyChart(driftChart, 'No monthly regional cost to show.');
    return;
  }

  const months = monthKeys(query.start, query.end);
  const regionTotals = aggregateRows(costRows, (row) => row.region)
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost))
    .slice(0, 5)
    .map((row) => row.key);
  const lookup = new Map();
  for (const row of costRows) {
    const key = `${row.month}@@${row.region}`;
    lookup.set(key, (lookup.get(key) || 0) + row.cost);
  }

  chartFor(driftChart).setOption({
    ...baseChartOption(),
    tooltip: {
      ...tooltipOption(),
      trigger: 'axis',
      valueFormatter: formatCost
    },
    legend: {
      right: 8,
      top: 4,
      textStyle: { color: colorVar('--ink') }
    },
    grid: { left: 64, right: 128, top: 36, bottom: 44 },
    xAxis: categoryAxis(months),
    yAxis: valueAxis({ name: 'Cost', formatter: formatAxisCost }),
    series: regionTotals.map((region) => ({
      name: region,
      type: 'line',
      smooth: false,
      symbol: 'circle',
      symbolSize: 5,
      data: months.map((month) => lookup.get(`${month}@@${region}`) || 0),
      lineStyle: { width: 2, color: regionSeriesColor(region) },
      itemStyle: { color: regionSeriesColor(region) }
    }))
  }, true);
}

function drawDailyCostExplorer(rows, query) {
  const dailySeries = enrichDailyCostSeries(dailyCostSeries(rows, query));

  syncDailyModeButtons();
  if (!dailySeries.length) {
    setChartTotal('dailyHeat', 0);
    drawEmptyChart(dailyHeatMap, 'No daily cost data to show.');
    return;
  }

  const stats = dailyExplorerStats(dailySeries);
  setChartTotal('dailyHeat', stats.total);
  if (!stats.maxAbsCost) {
    drawEmptyChart(dailyHeatMap, 'No non-zero daily cost in this window.');
    return;
  }

  if (dailyExplorerMode === 'spikes') {
    drawDailySpikeExplorer(dailySeries, stats);
  } else if (dailyExplorerMode === 'calendar') {
    drawDailyCalendarExplorer(dailySeries, stats);
  } else if (dailyExplorerMode === 'ranking') {
    drawDailyRankingExplorer(dailySeries, stats);
  } else if (dailyExplorerMode === 'pulse') {
    drawDailyPulseExplorer(dailySeries, stats);
  } else {
    drawDailyTimelineExplorer(dailySeries, stats);
  }
}

function drawDailyTimelineExplorer(series, stats) {
  const labels = series.map((row) => formatMonthDay(row.day));
  const xAxis = dailyCategoryAxis(labels, series.length);

  chartFor(dailyHeatMap).setOption({
    ...baseChartOption(),
    graphic: dailyExplorerGraphic('Timeline', stats),
    tooltip: {
      ...tooltipOption(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params;
        return dailyTooltip(series[first?.dataIndex || 0], [
          ['7-day average', formatCost(series[first?.dataIndex || 0]?.rollingAverage || 0)],
          ['Period-to-date', formatCost(series[first?.dataIndex || 0]?.cumulative || 0)]
        ]);
      }
    },
    legend: dailyLegend(['Daily cost', '7-day average']),
    grid: { left: 72, right: 30, top: 88, bottom: 70 },
    dataZoom: dailyXAxisZoom(series),
    xAxis,
    yAxis: valueAxis({ name: 'Cost', formatter: formatAxisCost }),
    series: [
      {
        name: 'Daily cost',
        type: 'bar',
        barMaxWidth: 22,
        data: series.map((row, index) => ({
          value: row.cost,
          itemStyle: {
            color: paletteColor(index, 0.88),
            borderRadius: row.cost >= 0 ? [5, 5, 0, 0] : [0, 0, 5, 5]
          }
        })),
        markPoint: stats.peak
          ? {
              symbol: 'pin',
              symbolSize: 46,
              label: { formatter: 'Peak', color: '#fff', fontWeight: 900, fontSize: 10 },
              itemStyle: { color: colorVar('--brand') },
              data: [{ name: 'Peak', coord: [formatMonthDay(stats.peak.day), stats.peak.cost] }]
            }
          : undefined
      },
      {
        name: '7-day average',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 3, color: colorVar('--brand') },
        itemStyle: { color: colorVar('--brand') },
        areaStyle: { color: colorWithAlpha(colorVar('--brand'), 0.1) },
        data: series.map((row) => row.rollingAverage),
        markLine: {
          symbol: 'none',
          label: {
            formatter: `Avg ${formatCost(stats.average)}`,
            color: colorVar('--muted'),
            fontWeight: 800
          },
          lineStyle: { color: colorVar('--muted'), type: 'dashed' },
          data: [{ yAxis: stats.average }]
        }
      }
    ]
  }, true);
}

function drawDailySpikeExplorer(series, stats) {
  const labels = series.map((row) => formatMonthDay(row.day));

  chartFor(dailyHeatMap).setOption({
    ...baseChartOption(),
    graphic: dailyExplorerGraphic('Spikes', stats, dailySpikeDetail(stats)),
    tooltip: {
      ...tooltipOption(),
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params;
        return dailyTooltip(series[first?.dataIndex || 0]);
      }
    },
    legend: dailyLegend(['Increase', 'Decrease', 'Daily cost']),
    grid: { left: 72, right: 78, top: 88, bottom: 70 },
    dataZoom: dailyXAxisZoom(series),
    xAxis: dailyCategoryAxis(labels, series.length),
    yAxis: [
      valueAxis({ name: 'Change', formatter: formatAxisCost }),
      valueAxis({ name: 'Cost', formatter: formatAxisCost })
    ],
    series: [
      {
        name: 'Increase',
        type: 'bar',
        stack: 'delta',
        barMaxWidth: 22,
        data: series.map((row) => row.hasPrevious && row.delta > 0 ? row.delta : null),
        itemStyle: { color: colorVar('--brand'), borderRadius: [5, 5, 0, 0] },
        markLine: {
          symbol: 'none',
          lineStyle: { color: colorVar('--line'), width: 2 },
          label: { show: false },
          data: [{ yAxis: 0 }]
        }
      },
      {
        name: 'Decrease',
        type: 'bar',
        stack: 'delta',
        barMaxWidth: 22,
        data: series.map((row) => row.hasPrevious && row.delta < 0 ? row.delta : null),
        itemStyle: { color: colorVar('--green'), borderRadius: [0, 0, 5, 5] }
      },
      {
        name: 'Daily cost',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 5,
        lineStyle: { width: 3, color: paletteColor(1) },
        itemStyle: { color: paletteColor(1) },
        data: series.map((row) => row.cost)
      }
    ]
  }, true);
}

function drawDailyCalendarExplorer(series, stats) {
  const values = series.map((row) => row.cost);
  const minCost = Math.min(0, ...values);
  const maxCost = Math.max(1, ...values);
  const compactCalendar = (dailyHeatMap.clientWidth || 0) < 760;

  chartFor(dailyHeatMap).setOption({
    ...baseChartOption(),
    graphic: dailyExplorerGraphic('Calendar', stats),
    tooltip: {
      ...tooltipOption(),
      trigger: 'item',
      formatter: ({ value }) => {
        const row = series[Number(value?.[3]) || 0];
        return dailyTooltip(row);
      }
    },
    visualMap: {
      min: minCost,
      max: maxCost,
      dimension: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 8,
      itemWidth: 14,
      itemHeight: 118,
      text: ['High', 'Low'],
      textStyle: { color: colorVar('--muted'), fontWeight: 800 },
      inRange: { color: ['#dff6e9', '#dcefff', '#ffe4aa', '#c74634'] }
    },
    calendar: {
      top: compactCalendar ? 112 : 92,
      left: compactCalendar ? 48 : 72,
      right: 28,
      bottom: 62,
      orient: 'vertical',
      range: [series[0].day, series[series.length - 1].day],
      cellSize: ['auto', compactCalendar ? 28 : 32],
      splitLine: { show: true, lineStyle: { color: colorVar('--panel'), width: 4 } },
      itemStyle: {
        color: colorVar('--panel'),
        borderColor: colorVar('--line'),
        borderWidth: 1
      },
      dayLabel: {
        color: colorVar('--muted'),
        firstDay: 0,
        position: 'start',
        nameMap: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        fontSize: 12,
        fontWeight: 900,
        margin: 8
      },
      monthLabel: {
        color: colorVar('--ink'),
        fontSize: 13,
        fontWeight: 900,
        margin: 12
      },
      yearLabel: { show: false }
    },
    series: [{
      name: 'Daily cost',
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: series.map((row, index) => ({
        name: row.day,
        value: [row.day, row.cost, row.delta, index, row.previous, row.hasPrevious ? 1 : 0]
      })),
      label: {
        show: true,
        formatter: ({ value }) => {
          const day = Number(String(value?.[0] || '').slice(8, 10));
          const cost = Number(value?.[1]) || 0;
          return compactCalendar ? String(day) : `${day}\n${formatCompactMoney(cost)}`;
        },
        color: colorVar('--ink'),
        fontSize: compactCalendar ? 11 : 12,
        fontWeight: 900
      },
      emphasis: {
        itemStyle: {
          borderColor: colorVar('--ink'),
          borderWidth: 2,
          shadowBlur: 12,
          shadowColor: colorVar('--shadow')
        }
      }
    }]
  }, true);
}

function drawDailyRankingExplorer(series, stats) {
  const ranked = series
    .slice()
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost) || a.day.localeCompare(b.day));
  const labels = ranked.map((row, index) => `${index + 1}. ${formatMonthDay(row.day)}`);

  chartFor(dailyHeatMap).setOption({
    ...baseChartOption(),
    graphic: dailyExplorerGraphic('Ranking', stats),
    tooltip: {
      ...tooltipOption(),
      trigger: 'item',
      formatter: ({ dataIndex }) => {
        const row = ranked[dataIndex || 0];
        return dailyTooltip(row, [['Rank', `#${(dataIndex || 0) + 1}`]]);
      }
    },
    grid: { left: 112, right: ranked.length > 16 ? 54 : 28, top: 76, bottom: 34 },
    dataZoom: dailyYAxisZoom(ranked),
    xAxis: valueAxis({ name: 'Cost', formatter: formatAxisCost }),
    yAxis: categoryAxis(labels, { inverse: true, width: 88 }),
    series: [{
      name: 'Daily cost',
      type: 'bar',
      barMaxWidth: 18,
      data: ranked.map((row, index) => ({
        value: row.cost,
        itemStyle: {
          color: dailyChangeColor(row, index, 0.9),
          borderRadius: row.cost >= 0 ? [0, 5, 5, 0] : [5, 0, 0, 5]
        }
      })),
      label: {
        show: true,
        position: 'right',
        formatter: ({ value }) => formatCost(value),
        color: colorVar('--ink'),
        fontWeight: 900
      },
      markLine: {
        symbol: 'none',
        lineStyle: { color: colorVar('--muted'), type: 'dashed' },
        label: { formatter: 'Average', color: colorVar('--muted'), fontWeight: 800 },
        data: [{ xAxis: stats.average }]
      }
    }]
  }, true);
}

function drawDailyPulseExplorer(series, stats) {
  const labels = series.map((row) => formatMonthDay(row.day));
  const maxCost = Math.max(...series.map((row) => Math.max(row.cost, 0)), 1);
  const angleAxis = {
    type: 'category',
    data: labels,
    startAngle: 90,
    clockwise: true,
    axisLabel: {
      color: colorVar('--muted'),
      fontWeight: 800,
      interval: Math.max(0, Math.ceil(series.length / 14) - 1)
    },
    axisLine: { lineStyle: { color: colorVar('--line') } },
    axisTick: { show: false }
  };

  chartFor(dailyHeatMap).setOption({
    ...baseChartOption(),
    graphic: dailyExplorerGraphic('Pulse', stats),
    tooltip: {
      ...tooltipOption(),
      trigger: 'item',
      formatter: ({ dataIndex }) => dailyTooltip(series[dataIndex || 0], [
        ['Monthly rhythm', `${formatMonthDay(series[dataIndex || 0]?.day)} of ${stats.windowLabel}`]
      ])
    },
    legend: dailyLegend(['Daily cost']),
    polar: {
      center: ['50%', '56%'],
      radius: '68%'
    },
    angleAxis,
    radiusAxis: {
      min: 0,
      max: maxCost,
      splitLine: { lineStyle: { color: colorVar('--line') } },
      axisLine: { lineStyle: { color: colorVar('--line') } },
      axisLabel: { color: colorVar('--muted'), formatter: formatAxisCost }
    },
    series: [{
      name: 'Daily cost',
      type: 'bar',
      coordinateSystem: 'polar',
      roundCap: true,
      barWidth: '58%',
      data: series.map((row, index) => ({
        value: Math.max(row.cost, 0),
        itemStyle: { color: paletteColor(index, 0.9) }
      }))
    }]
  }, true);
}

function syncDailyModeButtons() {
  for (const button of dailyModeButtons) {
    const active = (button.dataset.dailyMode || 'timeline') === dailyExplorerMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function enrichDailyCostSeries(series) {
  let cumulative = 0;
  return series.map((row, index, allRows) => {
    const cost = Number(row.cost) || 0;
    const previous = index ? Number(allRows[index - 1].cost) || 0 : 0;
    const rollingRows = allRows.slice(Math.max(0, index - 6), index + 1);
    const rollingAverage = rollingRows.reduce((sum, item) => sum + (Number(item.cost) || 0), 0) / rollingRows.length;
    cumulative += cost;

    return {
      ...row,
      cost,
      previous,
      delta: index ? cost - previous : 0,
      hasPrevious: index > 0,
      rollingAverage,
      cumulative
    };
  });
}

function dailyExplorerStats(series) {
  const total = series.reduce((sum, row) => sum + row.cost, 0);
  const average = series.length ? total / series.length : 0;
  const first = series[0];
  const last = series[series.length - 1];
  const nonZeroDays = series.filter((row) => row.cost !== 0);
  const peak = series
    .slice()
    .filter((row) => row.cost !== 0)
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost))[0] || first;
  const largestIncrease = series
    .filter((row) => row.hasPrevious)
    .sort((a, b) => b.delta - a.delta)[0];
  const largestDrop = series
    .filter((row) => row.hasPrevious)
    .sort((a, b) => a.delta - b.delta)[0];
  const windowLabel = first.day.slice(0, 7) === last.day.slice(0, 7)
    ? formatMonthTitle(first.day)
    : `${formatShortDate(first.day)} to ${formatShortDate(last.day)}`;

  return {
    total,
    average,
    first,
    last,
    peak,
    largestIncrease,
    largestDrop,
    windowLabel,
    maxAbsCost: Math.max(...series.map((row) => Math.abs(row.cost || 0)), 0),
    detail: nonZeroDays.length
      ? `Peak ${formatCost(peak.cost)} on ${formatMonthDay(peak.day)} | Avg ${formatCost(average)}`
      : `No non-zero daily cost | Avg ${formatCost(average)}`
  };
}

function dailyExplorerGraphic(mode, stats, detail = stats.detail) {
  const compact = (dailyHeatMap.clientWidth || 0) < 760;
  return [
    {
      type: 'text',
      left: 12,
      top: 10,
      style: {
        text: `${stats.windowLabel} | ${mode}`,
        fill: colorVar('--ink'),
        font: `900 ${compact ? 15 : 18}px Inter, system-ui, sans-serif`,
        textAlign: 'left',
        textVerticalAlign: 'top'
      }
    },
    {
      type: 'text',
      left: compact ? 12 : undefined,
      right: compact ? undefined : 16,
      top: compact ? 34 : 13,
      style: {
        text: detail,
        fill: colorVar('--muted'),
        font: `800 ${compact ? 11 : 12}px Inter, system-ui, sans-serif`,
        textAlign: compact ? 'left' : 'right',
        textVerticalAlign: 'top'
      }
    }
  ];
}

function dailyLegend(data) {
  return {
    data,
    left: 8,
    top: 42,
    itemWidth: 12,
    itemHeight: 8,
    textStyle: { color: colorVar('--muted'), fontWeight: 800 }
  };
}

function dailyCategoryAxis(labels, length) {
  const axis = categoryAxis(labels);
  axis.axisLabel.interval = Math.max(0, Math.ceil(length / 12) - 1);
  axis.axisLabel.fontWeight = 800;
  return axis;
}

function dailyXAxisZoom(series) {
  const zoom = [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }];
  if (series.length > 18) {
    zoom.push({
      type: 'slider',
      xAxisIndex: 0,
      bottom: 16,
      height: 18,
      borderColor: colorVar('--line'),
      fillerColor: colorWithAlpha(colorVar('--brand'), 0.14),
      handleStyle: { color: colorVar('--brand') },
      textStyle: { color: colorVar('--muted') }
    });
  }
  return zoom;
}

function dailyYAxisZoom(rows) {
  if (rows.length <= 16) return [];
  return [
    { type: 'inside', yAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: false, moveOnMouseWheel: true },
    {
      type: 'slider',
      yAxisIndex: 0,
      right: 8,
      width: 12,
      top: 78,
      bottom: 38,
      start: 0,
      end: Math.max(24, Math.min(100, (16 / rows.length) * 100)),
      borderColor: colorVar('--line'),
      fillerColor: colorWithAlpha(colorVar('--brand'), 0.14),
      handleStyle: { color: colorVar('--brand') },
      textStyle: { color: colorVar('--muted') }
    }
  ];
}

function dailyTooltip(row, extraRows = []) {
  if (!row) return '';
  return tooltipLines(formatLongDate(row.day), [
    ['Cost', formatCost(row.cost)],
    ['Previous day', row.hasPrevious ? formatCost(row.previous) : 'Period start'],
    ['Daily change', row.hasPrevious ? formatDelta(row.delta) : 'n/a'],
    ...extraRows
  ]);
}

function dailySpikeDetail(stats) {
  const increase = stats.largestIncrease && stats.largestIncrease.delta > 0
    ? `Up ${formatDelta(stats.largestIncrease.delta)} on ${formatMonthDay(stats.largestIncrease.day)}`
    : 'No daily increase';
  const drop = stats.largestDrop && stats.largestDrop.delta < 0
    ? `Down ${formatDelta(stats.largestDrop.delta)} on ${formatMonthDay(stats.largestDrop.day)}`
    : 'No daily decrease';
  return `${increase} | ${drop}`;
}

function dailyChangeColor(row, index, alpha = 1) {
  if (!row.hasPrevious || Math.abs(row.delta) < 0.01) return paletteColor(index, alpha);
  return row.delta > 0
    ? colorWithAlpha(colorVar('--brand'), alpha)
    : colorWithAlpha(colorVar('--green'), alpha);
}

function renderGroupByOptions(defaultGroupBy) {
  const selected = new Set(String(defaultGroupBy || 'service').split(',').map((item) => item.trim()).filter(Boolean));
  groupOptions.innerHTML = '';

  for (const option of groupByOptions) {
    const id = `groupBy-${option.value}`;
    const label = document.createElement('label');
    label.className = 'group-option';
    label.innerHTML = `
      <input type="checkbox" id="${id}" value="${escapeHtml(option.value)}">
      <span>${escapeHtml(option.label)}<small>${escapeHtml(option.value)}</small></span>
    `;
    const checkbox = label.querySelector('input');
    checkbox.checked = selected.has(option.value);
    checkbox.addEventListener('change', syncGroupBySelection);
    groupOptions.appendChild(label);
  }

  syncGroupBySelection();
}

function syncGroupBySelection(event) {
  const selected = Array.from(groupOptions.querySelectorAll('input:checked')).map((input) => input.value);
  if (!selected.length && event?.target) {
    event.target.checked = true;
    return;
  }

  groupByInput.value = selected.join(',');
  const labels = groupByOptions
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);
  groupSummary.textContent = labels.length <= 2 ? labels.join(', ') : `${labels.length} fields selected`;
}

function renderTableFilters(report) {
  for (const column of tableColumns) {
    const header = tableFilters.querySelector(`th[data-column="${column.key}"]`);
    if (!header) continue;
    const values = uniqueSorted(report.byGroup.map((row) => column.value(row)));

    header.innerHTML = `
      <div class="column-head">
        <span class="column-label">${escapeHtml(column.label)}</span>
        <details class="filter-menu column-filter" data-column="${escapeHtml(column.key)}">
          <summary>All</summary>
          <div class="filter-options">
            <input class="filter-search" type="search" placeholder="Type to filter" aria-label="Filter ${escapeHtml(column.label)} options">
            <div class="filter-actions">
              <button type="button" data-filter-action="all">All</button>
              <button type="button" data-filter-action="none">None</button>
            </div>
            <div class="filter-list"></div>
          </div>
        </details>
        <span class="resize-handle" data-column="${escapeHtml(column.key)}" role="separator" aria-label="Resize ${escapeHtml(column.label)} column"></span>
      </div>
    `;
    const details = header.querySelector('.filter-menu');
    const optionsEl = details.querySelector('.filter-list');

    for (const value of values) {
      const label = document.createElement('label');
      label.className = 'filter-option';
      label.innerHTML = `
        <input type="checkbox" value="${escapeHtml(value)}" checked>
        <span>${escapeHtml(value)}</span>
      `;
      label.querySelector('input').addEventListener('change', applyTableFilters);
      optionsEl.appendChild(label);
    }

    applyFilterSearch(details);
  }
}

function setFilterSelection(menu, action) {
  const options = Array.from(menu.querySelectorAll('.filter-option'))
    .filter((option) => !option.hidden)
    .map((option) => option.querySelector('input[type="checkbox"]'))
    .filter(Boolean);

  for (const checkbox of options) {
    checkbox.checked = action === 'all';
  }

  applyTableFilters();
}

function applyFilterSearch(menu) {
  const search = menu.querySelector('.filter-search');
  const query = normalizeFilterText(search?.value || '');
  let visibleCount = 0;

  for (const option of menu.querySelectorAll('.filter-option')) {
    const text = normalizeFilterText(option.textContent || '');
    const visible = !query || text.includes(query);
    option.hidden = !visible;
    if (visible) visibleCount += 1;
  }

  const list = menu.querySelector('.filter-list');
  let empty = menu.querySelector('.filter-empty');
  if (!empty) {
    empty = document.createElement('div');
    empty.className = 'filter-empty';
    empty.textContent = 'No matches';
    list?.appendChild(empty);
  }
  empty.hidden = visibleCount > 0;
}

function normalizeFilterText(value) {
  return String(value || '').trim().toLowerCase();
}

function applyTableFilters() {
  if (!currentReport) return;
  const activeFilters = Array.from(tableFilters.querySelectorAll('.filter-menu')).map((menu) => {
    const selected = new Set(Array.from(menu.querySelectorAll('input:checked')).map((input) => input.value));
    updateFilterSummary(menu, selected);
    const column = tableColumns.find((item) => item.key === menu.dataset.column);
    return { column, selected };
  });

  const filteredRows = currentReport.byGroup.filter((row) => activeFilters.every((filter) => {
    if (!filter.column || !filter.selected.size) return false;
    return filter.selected.has(filter.column.value(row));
  }));

  renderVisibleRows(filteredRows, calculateTotals(filteredRows));
}

function updateFilterSummary(menu, selected) {
  const column = tableColumns.find((item) => item.key === menu.dataset.column) || { label: menu.dataset.column };
  const total = menu.querySelectorAll('input[type="checkbox"]').length;
  const summary = menu.querySelector('summary');
  if (!selected.size) {
    summary.textContent = menu.classList.contains('column-filter') ? 'None' : `${column.label}: None`;
  } else if (selected.size === total) {
    summary.textContent = menu.classList.contains('column-filter') ? 'All' : `${column.label}: All`;
  } else if (selected.size === 1) {
    const value = Array.from(selected)[0];
    summary.textContent = menu.classList.contains('column-filter') ? value : `${column.label}: ${value}`;
  } else {
    summary.textContent = menu.classList.contains('column-filter') ? `${selected.size} selected` : `${column.label}: ${selected.size} selected`;
  }
}

function beginColumnResize(event) {
  const handle = event.target.closest('.resize-handle');
  if (!handle) return;

  event.preventDefault();
  const column = handle.dataset.column;
  const header = tableFilters.querySelector(`th[data-column="${column}"]`);
  const col = usageTable.querySelector(`col[data-column="${column}"]`);
  if (!header || !col) return;

  const startX = event.clientX;
  const startWidth = header.getBoundingClientRect().width;
  const minWidth = column === 'group' ? 220 : 92;

  document.body.classList.add('resizing-column');

  const resize = (moveEvent) => {
    const nextWidth = Math.max(minWidth, startWidth + moveEvent.clientX - startX);
    col.style.width = `${Math.round(nextWidth)}px`;
  };

  const stop = () => {
    document.body.classList.remove('resizing-column');
    document.removeEventListener('pointermove', resize);
    document.removeEventListener('pointerup', stop);
    document.removeEventListener('pointercancel', stop);
  };

  document.addEventListener('pointermove', resize);
  document.addEventListener('pointerup', stop);
  document.addEventListener('pointercancel', stop);
}

function calculateTotals(rows) {
  const currencies = new Set(rows.map((row) => (row.currency || '').trim()).filter(Boolean));
  return rows.reduce(
    (acc, row) => {
      acc.cost += row.cost || 0;
      acc.usage += row.usage || 0;
      acc.rowCount += row.count || 0;
      if (row.cost) acc.nonZeroCostRows += row.count || 1;
      if (row.usage) acc.nonZeroUsageRows += row.count || 1;
      return acc;
    },
    {
      cost: 0,
      usage: 0,
      rowCount: 0,
      nonZeroCostRows: 0,
      nonZeroUsageRows: 0,
      currency: currencies.size === 1 ? Array.from(currencies)[0] : ''
    }
  );
}

function renderRegionLegend(rows) {
  const regions = aggregateRows(rows, (row) => row.region || 'Unspecified')
    .filter((row) => row.cost !== 0)
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));

  regionLegendSection.hidden = !regions.length;
  regionLegend.innerHTML = regions.map((row) => `
    <span class="legend-chip" title="${escapeHtml(`${row.key}: ${formatCost(row.cost)}`)}">
      <span class="legend-swatch" style="--legend-color: ${escapeHtml(regionSeriesColor(row.key))}"></span>
      <span>${escapeHtml(row.key)}</span>
      <strong>${formatCost(row.cost)}</strong>
    </span>
  `).join('');
}

async function downloadExcel() {
  if (!currentReport) return;
  excelDownload.disabled = true;
  const response = await fetch('/api/usage.xlsx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: currentReport.query,
      totals: currentVisibleTotals,
      rows: currentVisibleRows.map((row) => ({
        ...row,
        percentOfCost: currentVisibleTotals?.cost ? (row.cost || 0) / currentVisibleTotals.cost : 0
      }))
    })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || body.error || 'Excel download failed');
  }

  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `oci-usage-${form.start.value}-to-${form.end.value}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
  excelDownload.disabled = false;
}

function downloadChart(key) {
  const element = chartElements[key];
  const chart = element ? charts.get(element) : undefined;
  if (!chart) return;

  const href = chart.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: colorVar('--panel')
  });
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `${sanitizeFilename(key || 'chart')}-${form.start.value}-to-${form.end.value}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function chartFor(element) {
  if (!echartsLib) throw new Error('ECharts failed to load.');
  if (!charts.has(element)) charts.set(element, echartsLib.init(element));
  return charts.get(element);
}

function drawEmptyChart(element, message) {
  const chart = chartFor(element);
  chart.setOption({
    ...baseChartOption(),
    title: {
      text: message,
      left: 'center',
      top: 'middle',
      textStyle: { color: colorVar('--muted'), fontSize: 13, fontWeight: 600 }
    },
    xAxis: { show: false },
    yAxis: { show: false },
    series: []
  }, true);
}

function baseChartOption() {
  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: colorVar('--ink'),
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    color: chartPalette()
  };
}

function tooltipOption() {
  return {
    borderWidth: 1,
    borderColor: colorVar('--line'),
    backgroundColor: colorVar('--panel'),
    textStyle: { color: colorVar('--ink') },
    extraCssText: `box-shadow:0 14px 32px ${colorVar('--shadow')};border-radius:8px;`
  };
}

function categoryAxis(data, options = {}) {
  return {
    type: 'category',
    data,
    inverse: options.inverse || false,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: colorVar('--line') } },
    axisLabel: {
      color: colorVar('--ink'),
      width: options.width,
      overflow: options.width ? 'truncate' : undefined,
      rotate: options.axisLabelRotate || 0
    }
  };
}

function valueAxis(options = {}) {
  return {
    type: options.type || 'value',
    name: options.name || '',
    min: options.min,
    max: options.max,
    splitLine: { lineStyle: { color: colorVar('--line') } },
    axisLine: { lineStyle: { color: colorVar('--line') } },
    axisLabel: {
      color: colorVar('--muted'),
      formatter: options.formatter
    },
    nameTextStyle: { color: colorVar('--muted') }
  };
}

function aggregateRows(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || 'Unspecified';
    const current = map.get(key) || { key, cost: 0, usage: 0, count: 0 };
    current.cost += row.cost || 0;
    current.usage += row.usage || 0;
    current.count += row.count || 1;
    map.set(key, current);
  }
  return Array.from(map.values());
}

function aggregateRowsWithDominantRegion(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || 'Unspecified';
    const region = row.region || 'Unspecified';
    const current = map.get(key) || { key, cost: 0, usage: 0, count: 0, regionCosts: new Map(), region };
    current.cost += row.cost || 0;
    current.usage += row.usage || 0;
    current.count += row.count || 1;
    current.regionCosts.set(region, (current.regionCosts.get(region) || 0) + Math.abs(row.cost || 0));
    current.region = dominantRegionFromMap(current.regionCosts);
    map.set(key, current);
  }
  return Array.from(map.values());
}

function aggregateCompartmentRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const path = compartmentPathForRow(row);
    const region = row.region || 'Unspecified';
    const current = map.get(path) || {
      path,
      cost: 0,
      usage: 0,
      count: 0,
      depth: compartmentDepthOfPath(path),
      regionCosts: new Map(),
      regionMagnitudes: new Map(),
      dominantRegion: 'Unspecified'
    };
    const cost = row.cost || 0;
    current.cost += cost;
    current.usage += row.usage || 0;
    current.count += row.count || 1;
    current.regionCosts.set(region, (current.regionCosts.get(region) || 0) + cost);
    current.regionMagnitudes.set(region, (current.regionMagnitudes.get(region) || 0) + Math.abs(cost));
    current.dominantRegion = dominantRegionFromMap(current.regionMagnitudes);
    map.set(path, current);
  }
  return Array.from(map.values());
}

function mergeCompartmentAggregates(path, rows) {
  const merged = {
    path,
    cost: 0,
    usage: 0,
    count: 0,
    depth: 'Mixed',
    regionCosts: new Map(),
    regionMagnitudes: new Map(),
    dominantRegion: 'Unspecified'
  };

  for (const row of rows) {
    merged.cost += row.cost || 0;
    merged.usage += row.usage || 0;
    merged.count += row.count || 0;
    for (const [region, cost] of row.regionCosts.entries()) {
      merged.regionCosts.set(region, (merged.regionCosts.get(region) || 0) + cost);
      merged.regionMagnitudes.set(region, (merged.regionMagnitudes.get(region) || 0) + Math.abs(cost || 0));
    }
  }

  merged.dominantRegion = dominantRegionFromMap(merged.regionMagnitudes);
  return merged;
}

function compartmentPathForRow(row) {
  const raw = valueFromGroup(row, 'compartmentPath') || row.group || 'root';
  const parts = String(raw)
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .split(/\s*(?:\/|>|\\)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return 'root';
  if (parts[0].toLowerCase() !== 'root') parts.unshift('root');
  return parts.join(' / ');
}

function displayCompartmentPath(path) {
  const parts = String(path || '')
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts[0]?.toLowerCase() === 'root') parts.shift();
  return parts.join(' / ') || 'Tenancy';
}

function compartmentDepthOfPath(path) {
  return Math.max(0, String(path || 'root').split(/\s*\/\s*/).filter(Boolean).length - 1);
}

function compartmentDepthDescription(query = {}) {
  const depth = query.compartmentDepth;
  if (depth === undefined || depth === null || depth === '') return 'Depth filter: Default';
  const parsed = Number.parseInt(depth, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 'Depth filter: Default';
  if (parsed === 0) return 'Depth filter: tenancy only';
  return `Depth filter: through level ${parsed}`;
}

function serviceSkuTree(rows) {
  const services = new Map();
  for (const row of rows.filter((item) => (item.cost || 0) > 0)) {
    const service = valueFromGroup(row, 'service') || 'Unspecified service';
    const sku = valueFromGroup(row, 'skuPartNumber') || valueFromGroup(row, 'skuName') || 'Unspecified SKU';
    const description = valueFromGroup(row, 'skuName') || 'Unspecified description';
    const cost = row.cost || 0;
    const usage = row.usage || 0;
    const count = row.count || 1;
    const region = row.region || 'Unspecified';

    const serviceNode = serviceNodeFor(services, service);
    const skuNode = serviceNodeFor(serviceNode.children, sku);
    const descriptionNode = serviceNodeFor(skuNode.children, description);

    for (const node of [serviceNode, skuNode, descriptionNode]) {
      node.cost += cost;
      node.usage += usage;
      node.count += count;
      node.regionCosts.set(region, (node.regionCosts.get(region) || 0) + Math.abs(cost));
      node.region = dominantRegionFromMap(node.regionCosts);
    }
  }

  return Array.from(services.values())
    .sort((a, b) => b.cost - a.cost)
    .map((node) => serviceSkuTreeNode(node, { service: node.key, path: [] }, 0));
}

function serviceNodeFor(map, key) {
  if (!map.has(key)) {
    map.set(key, {
      key,
      cost: 0,
      usage: 0,
      count: 0,
      region: 'Unspecified',
      regionCosts: new Map(),
      children: new Map()
    });
  }
  return map.get(key);
}

function serviceSkuTreeNode(node, context, depth) {
  const nextContext = {
    service: context.service || node.key,
    sku: depth >= 1 ? node.key : context.sku,
    description: depth >= 2 ? node.key : context.description,
    path: [...(context.path || []), node.key]
  };
  const children = Array.from(node.children.values())
    .sort((a, b) => b.cost - a.cost)
    .map((child) => serviceSkuTreeNode(child, nextContext, depth + 1));
  const colorKey = depth === 0
    ? nextContext.service
    : depth === 1
      ? nextContext.sku
      : `${nextContext.sku || nextContext.service} / ${nextContext.description || node.key}`;
  const baseColor = categorySeriesColor(colorKey);

  return {
    name: node.key,
    value: Math.abs(node.cost),
    rawCost: node.cost,
    usage: node.usage,
    count: node.count,
    region: node.region,
    service: nextContext.service,
    sku: nextContext.sku,
    description: nextContext.description,
    path: nextContext.path.join(' / '),
    colorKey,
    baseColor,
    children
  };
}

function serviceSkuCards(tree) {
  const serviceLimit = 5;
  const cards = tree.slice(0, serviceLimit).map(serviceSkuCardForService);
  const remaining = tree.slice(serviceLimit);
  if (remaining.length) {
    const rawCost = remaining.reduce((sum, node) => sum + (node.rawCost || 0), 0);
    const usage = remaining.reduce((sum, node) => sum + (node.usage || 0), 0);
    const count = remaining.reduce((sum, node) => sum + (node.count || 0), 0);
    cards.push({
      kind: 'service',
      name: 'Other services',
      rawCost,
      usage,
      count,
      region: dominantRegion(remaining),
      colorKey: 'Other services',
      baseColor: categorySeriesColor('Other services'),
      lines: remaining.slice(0, 4).map((node) => ({
      kind: 'service-line',
      service: node.name,
      sku: 'Mixed',
      description: `${node.children?.length || 0} SKU groups`,
      label: skuDescriptionLabel(node.name, `${node.children?.length || 0} SKU groups`),
      rawCost: node.rawCost,
      usage: node.usage,
      count: node.count,
        region: node.region,
        colorKey: node.name
      }))
    });
  }
  return cards;
}

function serviceSkuCardForService(service) {
  const skuLimit = 3;
  const skus = (service.children || []).slice().sort((a, b) => (b.rawCost || 0) - (a.rawCost || 0));
  const lines = skus.slice(0, skuLimit).map((sku) => serviceSkuCardLine(service, sku));
  const remaining = skus.slice(skuLimit);
  if (remaining.length) {
    lines.push({
      kind: 'sku',
      service: service.name,
      sku: 'Other',
      description: `${remaining.length} ${service.name} SKUs`,
      label: skuDescriptionLabel('Other', `${remaining.length} ${service.name} SKUs`),
      rawCost: remaining.reduce((sum, node) => sum + (node.rawCost || 0), 0),
      usage: remaining.reduce((sum, node) => sum + (node.usage || 0), 0),
      count: remaining.reduce((sum, node) => sum + (node.count || 0), 0),
      region: dominantRegion(remaining),
      colorKey: `${service.name} Other`
    });
  }

  return {
    kind: 'service',
    name: service.name,
    rawCost: service.rawCost,
    usage: service.usage,
    count: service.count,
    region: service.region,
    colorKey: service.name,
    baseColor: categorySeriesColor(service.name),
    lines
  };
}

function serviceSkuCardLine(service, sku) {
  const description = sku.children?.length === 1
    ? sku.children[0].name
    : `${sku.children?.length || 0} descriptions`;
  return {
    kind: 'sku',
    service: service.name,
    sku: sku.name,
    description,
    label: skuDescriptionLabel(sku.name, description),
    rawCost: sku.rawCost,
    usage: sku.usage,
    count: sku.count,
    region: sku.region,
    colorKey: `${service.name} ${sku.name}`
  };
}

function skuDescriptionLabel(sku, description) {
  const skuText = String(sku || '').trim();
  const descriptionText = String(description || '').trim();
  if (!skuText) return descriptionText || 'Unspecified SKU';
  if (!descriptionText || descriptionText === 'Unspecified description' || descriptionText === skuText) return skuText;
  return `${skuText} - ${descriptionText}`;
}

function renderServiceSkuCardItem(params, api, cards, maxCost) {
  const card = cards[params.dataIndex];
  if (!card) return undefined;

  const width = api.getWidth();
  const height = api.getHeight();
  const columns = width >= 960 ? 2 : 1;
  const cardGap = 12;
  const left = 18;
  const right = 18;
  const top = 14;
  const bottom = 36;
  const rows = Math.ceil(cards.length / columns);
  const plotWidth = Math.max(20, width - left - right);
  const cardWidth = Math.max(220, (plotWidth - cardGap * (columns - 1)) / columns);
  const cardHeight = Math.max(118, Math.min(154, (height - top - bottom - cardGap * Math.max(rows - 1, 0)) / rows));
  const column = params.dataIndex % columns;
  const row = Math.floor(params.dataIndex / columns);
  const x = left + column * (cardWidth + cardGap);
  const y = top + row * (cardHeight + cardGap);
  const input = colorVar('--input');
  const line = colorVar('--line');
  const ink = colorVar('--ink');
  const muted = colorVar('--muted');
  const fill = categorySeriesColor(card.colorKey, 0.9);
  const children = [
    {
      type: 'rect',
      info: card,
      shape: { x, y, width: cardWidth, height: cardHeight, r: 9 },
      style: {
        fill: input,
        stroke: line,
        lineWidth: 1,
        shadowBlur: 8,
        shadowColor: colorVar('--shadow'),
        shadowOffsetY: 2
      }
    },
    {
      type: 'rect',
      info: card,
      shape: { x: x + 10, y: y + 12, width: 5, height: 28, r: 3 },
      style: { fill }
    },
    {
      type: 'text',
      info: card,
      style: {
        x: x + 22,
        y: y + 14,
        text: truncate(card.name, Math.max(12, Math.floor((cardWidth - 150) / 7))),
        fill: ink,
        font: '900 14px Inter, system-ui, sans-serif',
        textAlign: 'left',
        textVerticalAlign: 'top'
      }
    },
    {
      type: 'text',
      info: card,
      style: {
        x: x + cardWidth - 14,
        y: y + 14,
        text: formatCost(card.rawCost || 0),
        fill: ink,
        font: '900 13px Inter, system-ui, sans-serif',
        textAlign: 'right',
        textVerticalAlign: 'top'
      }
    }
  ];

  const trackX = x + 22;
  const trackY = y + 37;
  const trackWidth = Math.max(40, cardWidth - 36);
  children.push(
    {
      type: 'rect',
      info: card,
      shape: { x: trackX, y: trackY, width: trackWidth, height: 9, r: 9 },
      style: { fill: colorWithAlpha(line, 0.42) }
    },
    {
      type: 'rect',
      info: card,
      shape: { x: trackX, y: trackY, width: Math.max(5, trackWidth * ((card.rawCost || 0) / maxCost)), height: 9, r: 9 },
      style: { fill }
    }
  );

  const lineTop = y + 58;
  const visibleLines = card.lines.slice(0, 4);
  const lineHeight = Math.max(18, Math.min(23, (cardHeight - 66) / Math.max(visibleLines.length, 1)));
  const maxLineCost = Math.max(...visibleLines.map((item) => item.rawCost || 0), 1);

  for (const [index, item] of visibleLines.entries()) {
    const rowY = lineTop + index * lineHeight;
    const itemColor = categorySeriesColor(item.colorKey, 0.82);
    children.push(
      {
        type: 'rect',
        info: item,
        invisible: true,
        silent: false,
        shape: { x: x + 14, y: rowY - 2, width: cardWidth - 28, height: lineHeight, r: 4 },
        style: { fill: 'rgba(0,0,0,0)' }
      },
      {
        type: 'rect',
        info: item,
        shape: { x: x + 22, y: rowY + lineHeight - 6, width: Math.max(4, (cardWidth - 160) * ((item.rawCost || 0) / maxLineCost)), height: 4, r: 4 },
        style: { fill: itemColor }
      },
      {
        type: 'text',
        info: item,
        style: {
          x: x + 22,
          y: rowY,
          text: truncate(item.label || skuDescriptionLabel(item.sku || item.service, item.description), Math.max(14, Math.floor((cardWidth - 136) / 6.4))),
          fill: ink,
          font: '900 11px Inter, system-ui, sans-serif',
          textAlign: 'left',
          textVerticalAlign: 'top'
        }
      },
      {
        type: 'text',
        info: item,
        style: {
          x: x + cardWidth - 14,
          y: rowY,
          text: formatCost(item.rawCost || 0),
          fill: ink,
          font: '900 11px Inter, system-ui, sans-serif',
          textAlign: 'right',
          textVerticalAlign: 'top'
        }
      }
    );
  }

  if (!visibleLines.length) {
    children.push({
      type: 'text',
      info: card,
      style: {
        x: x + 22,
        y: lineTop,
        text: 'No SKU detail available',
        fill: muted,
        font: '800 11px Inter, system-ui, sans-serif',
        textAlign: 'left',
        textVerticalAlign: 'top'
      }
    });
  }

  return { type: 'group', children };
}

function serviceSkuCardTooltip(item, total) {
  if (!item) return '';
  if (item.kind === 'service') {
    return tooltipLines(item.name, [
      ['Service total', formatCost(item.rawCost || 0)],
      ['Share', percent.format((item.rawCost || 0) / total)],
      ['Usage', number.format(item.usage || 0)],
      ['Rows', number.format(item.count || 0)],
      ['Dominant region', item.region || 'Unspecified'],
      ['Visible detail', `${number.format(item.lines?.length || 0)} rows`]
    ]);
  }

  const skuLabel = item.label || skuDescriptionLabel(item.sku, item.description);
  return tooltipLines(`${item.service || 'Service'} / ${skuLabel}`, [
    ['SKU', item.sku || 'Mixed'],
    ['SKU description', item.description || 'Mixed'],
    ['Cost', formatCost(item.rawCost || 0)],
    ['Share', percent.format((item.rawCost || 0) / total)],
    ['Usage', number.format(item.usage || 0)],
    ['Rows', number.format(item.count || 0)],
    ['Dominant region', item.region || 'Unspecified']
  ]);
}

function valueFromGroup(row, key) {
  const value = row.groupValues?.[key];
  return value && value !== 'Unspecified' ? value : '';
}

function dailyCostSeries(rows, query) {
  const days = dayKeys(query.start, query.end);
  const dailyTotals = new Map(days.map((day) => [day, 0]));
  for (const row of rows) {
    const day = String(row.timeUsageStarted || row.timeUsageEnded || '').slice(0, 10);
    if (!dailyTotals.has(day)) continue;
    dailyTotals.set(day, (dailyTotals.get(day) || 0) + rawCost(row));
  }
  return days.map((day) => ({ day, cost: dailyTotals.get(day) || 0 }));
}

function skuNameForRow(row) {
  return row.groupValues?.skuPartNumber ||
    row.groupValues?.skuName ||
    String(row.group || '').split(' | ')[1] ||
    row.group ||
    'Unspecified';
}

function sumCost(rows) {
  return rows.reduce((sum, row) => sum + (row.cost || 0), 0);
}

function sumRawCost(rows) {
  return rows.reduce((sum, row) => sum + rawCost(row), 0);
}

function setChartTotal(key, value) {
  const element = chartTotals[key];
  if (!element) return;
  element.textContent = `Total ${formatCost(value || 0)}`;
}

function topRows(rows, limit) {
  return rows
    .filter((row) => (row.cost || 0) > 0)
    .slice()
    .sort((a, b) => b.cost - a.cost || b.usage - a.usage)
    .slice(0, limit);
}

function topRowsByMagnitude(rows, limit) {
  return rows
    .filter((row) => (row.cost || 0) !== 0)
    .slice()
    .sort((a, b) => Math.abs(b.cost || 0) - Math.abs(a.cost || 0) || b.usage - a.usage)
    .slice(0, limit);
}

function selectChartMetric(report, rows = report.byGroup || []) {
  if (rows.some((row) => (row.cost || 0) !== 0)) {
    return {
      value: (row) => row.cost || 0,
      format: (value) => formatCost(value),
      note: 'Top grouped usage by net cost. Colors highlight the grouped categories.'
    };
  }

  if ((report.totals.usage || 0) > 0) {
    return {
      value: (row) => row.usage || 0,
      format: (value) => number.format(value),
      note: 'Cost is zero for this query, so the chart is using usage quantity. Colors highlight the grouped categories.'
    };
  }

  return {
    value: (row) => row.count || 0,
    format: (value) => `${number.format(value)} rows`,
    note: 'OCI returned rows, but all cost and usage values are zero. Charting row count with category colors.'
  };
}

function statusFor(report, visibleGroups = report.byGroup.length, totalGroups = report.byGroup.length) {
  const generated = new Date(report.generatedAt).toLocaleString();
  if (report.totals.rowCount && !report.totals.nonZeroCostRows && !report.totals.nonZeroUsageRows) {
    return `${visibleGroups} of ${totalGroups} groups, ${report.totals.rowCount} rows with zero values ${generated}`;
  }
  return `${visibleGroups} of ${totalGroups} groups generated ${generated}`;
}

function emptyGroupedUsageMessage(report) {
  if (!report) return 'No grouped usage rows match the active filters.';
  if (report.byGroup?.length) return 'No grouped usage rows match the active filters.';
  return emptyCostWindowMessage(report);
}

function emptyCostWindowMessage(report) {
  const rawRows = report?.totals?.rowCount || 0;
  if (rawRows) {
    return `No non-zero cost groups for this window; OCI returned ${number.format(rawRows)} raw zero-cost rows`;
  }
  return 'No cost data returned for this window.';
}

function applyTheme(theme, rerender) {
  document.documentElement.dataset.theme = theme;
  themeSelector.value = theme;
  localStorage.setItem('oci-cost-theme', theme);

  if (!rerender) return;
  for (const chart of charts.values()) chart.dispose();
  charts.clear();
  if (currentReport) applyTableFilters();
  if (currentInsights) renderInsights(currentInsights);
}

function setScanState(state, label) {
  scanStatus.textContent = label;
  scanStatus.dataset.state = state;
}

function updateFooterWindow(start, end) {
  footerWindow.textContent = start && end ? `${start} to ${end}` : 'Not selected';
}

function updateBillingSummaryWindow(start, end) {
  billingSummaryWindow.textContent = analysisWindowLabel(start, end);
  const days = analysisDayCount(start, end);
  billingSummaryDays.textContent = days === undefined ? '0 days' : `${number.format(days)} ${days === 1 ? 'day' : 'days'}`;
}

function updateFooterLastScan(timestamp) {
  if (!timestamp) {
    footerLastScan.textContent = 'Not run';
    return;
  }
  footerLastScan.textContent = new Date(timestamp).toLocaleString();
}

function setBillingSummaryPending() {
  uniqueSkuCount.textContent = '...';
  uniqueSkuDetail.textContent = 'Scanning SKUs';
  activeRegionCount.textContent = '...';
  activeRegionDetail.textContent = 'Scanning regions';
  dailyAverageCost.textContent = '...';
  dailyAverageDetail.textContent = 'Scanning daily cost';
  peakDailyCost.textContent = '...';
  peakDailyDetail.textContent = 'Scanning peak day';
}

function setBillingSummaryUnavailable() {
  uniqueSkuCount.textContent = '0';
  uniqueSkuDetail.textContent = 'SKU scan unavailable';
  activeRegionCount.textContent = '0';
  activeRegionDetail.textContent = 'Region scan unavailable';
  dailyAverageCost.textContent = '$0.00';
  dailyAverageDetail.textContent = 'Daily scan unavailable';
  peakDailyCost.textContent = '$0.00';
  peakDailyDetail.textContent = 'Peak scan unavailable';
}

function analysisDayCount(start, end) {
  if (!start || !end || start >= end) return undefined;
  return dayKeys(start, end).length;
}

function analysisWindowLabel(start, end) {
  if (!start || !end || start >= end) return 'Not selected';
  const endDate = parseIsoDate(end);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const inclusiveEnd = endDate.toISOString().slice(0, 10);
  return start === inclusiveEnd ? start : `${start} to ${inclusiveEnd}`;
}

function colorVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function chartPalette() {
  return [
    '#c74634',
    '#2a6f97',
    '#6d5bd0',
    '#c48a18',
    '#b5467a',
    '#117b73',
    '#e67300',
    '#4e79a7',
    '#a05195',
    '#d45087',
    '#3a9d8f',
    '#8a6f2a'
  ];
}

function paletteColor(index, alpha = 1) {
  const colors = chartPalette();
  const color = colors[index % colors.length];
  return colorWithAlpha(color, alpha);
}

function categorySeriesColor(value, alpha = 1) {
  return paletteColor(hashString(value || 'Unspecified'), alpha);
}

function colorWithAlpha(color, alpha = 1) {
  if (alpha === 1) return color;
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(Math.max(alpha, 0), 1)})`;
}

function hexToRgb(color) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color || '').trim());
  if (!match) return null;
  const hex = match[1].length === 3
    ? match[1].split('').map((char) => `${char}${char}`).join('')
    : match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function readableTextColor(color) {
  const rgb = hexToRgb(color);
  if (!rgb) return '#ffffff';
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.58 ? '#172033' : '#ffffff';
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value || 'Unspecified')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function dominantRegion(rows) {
  const regionCosts = new Map();
  for (const row of rows) {
    const region = row.region || 'Unspecified';
    regionCosts.set(region, (regionCosts.get(region) || 0) + Math.abs(row.cost ?? row.rawCost ?? 0));
  }
  return dominantRegionFromMap(regionCosts);
}

function dominantRegionFromMap(regionCosts) {
  return Array.from(regionCosts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'Unspecified';
}

function rawCost(row) {
  return numeric(row.computedAmount) || numeric(row.attributedCost) || numeric(row.cost);
}

function numeric(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function driftWindowFor(endDate) {
  const end = parseMonthDate(endDate);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 6, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function parseMonthDate(value) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
  if (!match) return new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function monthKeys(startDate, endDate) {
  const keys = [];
  const cursor = parseMonthDate(startDate);
  const end = parseMonthDate(endDate);
  while (cursor < end) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

function dayKeys(startDate, endDate) {
  const keys = [];
  const cursor = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  while (cursor < end) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatCost(value) {
  const amount = Number(value) || 0;
  if (amount !== 0 && Math.abs(amount) < 0.01) {
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${Math.abs(amount).toFixed(4)}`;
  }
  return money.format(amount);
}

function formatCompactMoney(value) {
  const amount = Number(value) || 0;
  if (amount < 1) return `$${amount.toFixed(2)}`;
  return `$${compactNumber.format(amount)}`;
}

function formatDelta(value) {
  const amount = Number(value) || 0;
  if (!amount) return '$0.00';
  return `${amount > 0 ? '+' : '-'}${formatCost(Math.abs(amount))}`;
}

function formatLongDate(value) {
  return parseIsoDate(String(value)).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function formatMonthTitle(value) {
  return parseIsoDate(String(value)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function formatMonthDay(value) {
  return parseIsoDate(String(value)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

function formatShortDate(value) {
  return parseIsoDate(String(value)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function formatAxisCost(value) {
  const amount = Number(value) || 0;
  if (amount !== 0 && Math.abs(amount) < 1) return formatCost(amount);
  return `$${compactNumber.format(amount)}`;
}

function dailyCostIntensity(value, maxCost) {
  return Math.min(1, Math.abs(Number(value) || 0) / Math.max(Math.abs(Number(maxCost) || 0), 1));
}

function dailyCostColor(value, maxCost) {
  if (!value) return colorVar('--panel');
  const intensity = dailyCostIntensity(value, maxCost);
  const lightness = 96 - intensity * 44;
  const saturation = 54 + intensity * 16;
  const hue = value >= 0 ? 10 : 154;
  return `hsl(${hue} ${saturation}% ${lightness}% / 0.96)`;
}

function formatAxisNumber(value) {
  return compactNumber.format(value);
}

function tooltipLines(title, rows) {
  return `
    <strong>${escapeHtml(title)}</strong>
    <div class="chart-tooltip">
      ${rows.map(([label, value]) => `<span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b>`).join('')}
    </div>
  `;
}

function wrapChartLabel(value, maxLineLength) {
  const words = String(value || 'Unspecified').split(/\s+/).filter(Boolean);
  const lines = [];

  for (const word of words) {
    const current = lines[lines.length - 1] || '';
    if (!current) {
      lines.push(word);
    } else if ((current.length + word.length + 1) <= maxLineLength) {
      lines[lines.length - 1] = `${current} ${word}`;
    } else {
      lines.push(word);
    }
  }

  return lines.join('\n') || 'Unspecified';
}

function truncate(value, maxLength) {
  const text = String(value || 'Unspecified');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function sanitizeFilename(value) {
  return String(value || 'chart')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'chart';
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function regionColor(region, saturation, lightness, alpha = 1) {
  let hash = 0;
  for (const char of String(region || 'Unspecified')) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} ${saturation}% ${lightness}% / ${alpha})`;
}

function regionSeriesColor(region, alpha = 1) {
  return regionColor(region, 58, 45, alpha);
}

function showError(error) {
  setScanState('error', 'Scan failed');
  statusText.textContent = error.message;
  insightStatus.textContent = '';
  chartNote.textContent = '';
  rowsEl.innerHTML = '';
  resetColumnHeaders();
  drawEmptyChart(usageChart, error.message || 'Unable to load usage.');
  excelDownload.disabled = false;
}

function resetColumnHeaders() {
  for (const column of tableColumns) {
    const header = tableFilters.querySelector(`th[data-column="${column.key}"]`);
    if (!header) continue;
    header.innerHTML = `
      <div class="column-head">
        <span class="column-label">${escapeHtml(column.label)}</span>
        <span class="resize-handle" data-column="${escapeHtml(column.key)}" role="separator" aria-label="Resize ${escapeHtml(column.label)} column"></span>
      </div>
    `;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}
