import express from 'express';
import { performance } from 'node:perf_hooks';
import { GROUP_BY_OPTIONS, getAppConfig, normalizeUsageQuery } from './config.js';
import { createAuthProvider, getAuthProviderTenancyId } from './ociAuth.js';
import { createUsageClient, requestSummarizedUsage } from './usageClient.js';
import { buildUsageReport, reportToCsv, reportToXlsxBuffer } from './usageReport.js';
import { createTtlCache } from './cache.js';
import { createReportStore, reportStoreKey } from './reportStore.js';

const config = getAppConfig();
const app = express();
const cache = createTtlCache(config.cacheTtlSeconds);
const reportStore = createReportStore(config.persistence);
const inFlightReports = new Map();

let ociContextPromise;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use('/vendor/echarts', express.static(new URL('../node_modules/echarts/dist', import.meta.url).pathname));
app.use(express.static(new URL('../public', import.meta.url).pathname));

app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/defaults', async (req, res) => {
  const tenancy = await getTenancyInfo();
  res.json({
    authMethod: config.authMethod,
    profile: config.profile,
    region: config.usageRegion,
    defaults: config.defaults,
    groupByOptions: GROUP_BY_OPTIONS,
    persistence: {
      enabled: config.persistence.enabled
    },
    hasTenancyId: tenancy.hasTenancyId,
    tenancySource: tenancy.source
  });
});

app.get('/api/usage', async (req, res, next) => {
  try {
    const report = await getReport(req.query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

app.get('/api/usage/latest', async (req, res, next) => {
  try {
    const stored = await readLatestDashboardReport();
    if (!stored) {
      const error = new Error('No persisted dashboard scan exists.');
      error.statusCode = 404;
      throw error;
    }
    const includeRows = boolParam(req.query.includeRows);
    res.json(reportResponse(stored.report, includeRows, {
      source: 'disk',
      cacheHit: true,
      stale: true,
      latest: true,
      persistedAt: stored.savedAt
    }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/usage.csv', async (req, res, next) => {
  try {
    const report = await getReport(req.query);
    res.type('text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="oci-usage-summary.csv"');
    res.send(reportToCsv(report));
  } catch (error) {
    next(error);
  }
});

app.get('/api/usage.xlsx', async (req, res, next) => {
  try {
    const report = await getReport(req.query);
    await sendWorkbook(res, report);
  } catch (error) {
    next(error);
  }
});

app.post('/api/usage.xlsx', async (req, res, next) => {
  try {
    await sendWorkbook(res, reportFromPostedTable(req.body));
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || error.status || 500;
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : error.message,
    detail: error.message,
    code: error.code || error.serviceCode,
    opcRequestId: error.opcRequestId || error.opcRequestID,
    operation: error.operationName,
    targetService: error.targetService
  });
});

async function getReport(rawQuery) {
  const includeRows = boolParam(rawQuery.includeRows);
  const cacheOnly = boolParam(rawQuery.cacheOnly) || boolParam(rawQuery.storedOnly);
  const refresh = boolParam(rawQuery.refresh) || boolParam(rawQuery.forceRefresh);
  const remember = boolParam(rawQuery.remember) || boolParam(rawQuery.dashboard);
  const context = await getOciContext();
  const query = normalizeUsageQuery(rawQuery, {
    ...config,
    tenancyId: config.tenancyId || context.tenancyId
  });
  const cacheKey = JSON.stringify(query);
  const storeKey = reportStoreKey(query);

  if (!refresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return reportResponse(cached, includeRows, {
        source: 'memory',
        cacheHit: true,
        stale: false
      });
    }

    const stored = await readStoredReport(storeKey);
    if (stored) {
      cache.set(cacheKey, stored.report);
      return reportResponse(stored.report, includeRows, {
        source: 'disk',
        cacheHit: true,
        stale: true,
        persistedAt: stored.savedAt
      });
    }
  }

  if (cacheOnly) {
    const error = new Error('No persisted report exists for this query.');
    error.statusCode = 404;
    throw error;
  }

  const report = await getFreshReport(context.client, query, cacheKey, storeKey, { remember });
  return reportResponse(report, includeRows, {
    source: 'oci',
    cacheHit: false,
    stale: false
  });
}

async function getFreshReport(client, query, cacheKey, storeKey, options = {}) {
  const existing = inFlightReports.get(cacheKey);
  if (existing) return existing;

  const promise = Promise.resolve()
    .then(async () => {
      const startedAt = performance.now();
      const { items, metrics } = await requestSummarizedUsage(client, query);
      const report = buildUsageReport(items, query);
      report.scanMetrics = scanMetrics(metrics, performance.now() - startedAt);
      cache.set(cacheKey, report);
      await persistReport(storeKey, report, options);
      return report;
    })
    .finally(() => {
      inFlightReports.delete(cacheKey);
    });

  inFlightReports.set(cacheKey, promise);
  return promise;
}

async function readStoredReport(storeKey) {
  if (!reportStore.enabled) return undefined;
  try {
    return await reportStore.get(storeKey);
  } catch (error) {
    console.warn(`Unable to read persisted usage report: ${error.message}`);
    return undefined;
  }
}

async function readLatestDashboardReport() {
  if (!reportStore.enabled) return undefined;
  try {
    return await reportStore.getLatestDashboard();
  } catch (error) {
    console.warn(`Unable to read latest dashboard report: ${error.message}`);
    return undefined;
  }
}

async function persistReport(storeKey, report, options = {}) {
  if (!reportStore.enabled) return;
  try {
    const stored = await reportStore.set(storeKey, report);
    if (options.remember) await reportStore.setLatestDashboard(stored);
  } catch (error) {
    console.warn(`Unable to persist usage report: ${error.message}`);
  }
}

function reportResponse(report, includeRows, delivery) {
  const response = includeRows ? { ...report } : withoutRows(report);
  return {
    ...response,
    delivery
  };
}

function scanMetrics(metrics = {}, serverLatencyMs) {
  return {
    apiCalls: metrics.apiCalls || 0,
    rowsReturned: metrics.rowsReturned || 0,
    requestBytes: metrics.requestBytes || 0,
    responseBytes: metrics.responseBytes || 0,
    ociLatencyMs: roundMs(metrics.ociLatencyMs || 0),
    serverLatencyMs: roundMs(serverLatencyMs || 0),
    pageLatenciesMs: metrics.pageLatenciesMs || [],
    operations: (metrics.operations || []).map((operation) => ({
      ...operation,
      latencyMs: roundMs(operation.latencyMs || 0)
    }))
  };
}

function boolParam(value) {
  if (Array.isArray(value)) return value.some((item) => boolParam(item));
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function roundMs(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function sendWorkbook(res, report) {
  const buffer = await reportToXlsxBuffer(report);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="oci-usage-summary.xlsx"');
  res.send(buffer);
}

function reportFromPostedTable(body = {}) {
  if (!Array.isArray(body.rows)) {
    const error = new Error('rows must be an array.');
    error.statusCode = 400;
    throw error;
  }

  const rows = body.rows.slice(0, 5000).map((row) => ({
    region: stringValue(row.region || 'Unspecified'),
    group: stringValue(row.group || 'All Usage'),
    cost: numberValue(row.cost),
    usage: numberValue(row.usage),
    currency: stringValue(row.currency || ''),
    percentOfCost: numberValue(row.percentOfCost),
    count: numberValue(row.count)
  }));

  const currencies = new Set(rows.map((row) => row.currency).filter(Boolean));
  const totals = rows.reduce(
    (acc, row) => {
      acc.cost += row.cost;
      acc.usage += row.usage;
      acc.rowCount += row.count;
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

  return {
    query: body.query || {},
    generatedAt: new Date().toISOString(),
    totals: {
      ...totals,
      cost: Math.round((totals.cost + Number.EPSILON) * 1000000) / 1000000
    },
    byGroup: rows
  };
}

function stringValue(value) {
  return String(value ?? '').slice(0, 1000);
}

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function withoutRows(report) {
  const { rows, ...summary } = report;
  return summary;
}

async function getOciContext() {
  if (!ociContextPromise) {
    ociContextPromise = Promise.resolve().then(async () => {
      const provider = await createAuthProvider(config);
      return {
        client: createUsageClient(provider, config.usageRegion),
        tenancyId: getAuthProviderTenancyId(provider)
      };
    });
  }
  return ociContextPromise;
}

async function getTenancyInfo() {
  if (config.tenancyId) return { hasTenancyId: true, source: 'OCI_TENANCY_OCID' };
  if (config.authMethod !== 'config') return { hasTenancyId: false, source: 'not_configured' };

  try {
    const provider = await createAuthProvider(config);
    return {
      hasTenancyId: Boolean(getAuthProviderTenancyId(provider)),
      source: 'oci_config_profile'
    };
  } catch {
    return { hasTenancyId: false, source: 'oci_config_profile_unavailable' };
  }
}

app.listen(config.port, () => {
  console.log(`OCI cost usage app listening on http://0.0.0.0:${config.port}`);
});
