import express from 'express';
import { GROUP_BY_OPTIONS, getAppConfig, normalizeUsageQuery } from './config.js';
import { createAuthProvider, getAuthProviderTenancyId } from './ociAuth.js';
import { createUsageClient, requestSummarizedUsage } from './usageClient.js';
import { buildUsageReport, reportToCsv, reportToXlsxBuffer } from './usageReport.js';
import { createTtlCache } from './cache.js';

const config = getAppConfig();
const app = express();
const cache = createTtlCache(config.cacheTtlSeconds);

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
    detail: process.env.NODE_ENV === 'production' && statusCode >= 500 ? undefined : error.message
  });
});

async function getReport(rawQuery) {
  const includeRows = String(rawQuery.includeRows || '').toLowerCase() === 'true';
  const context = await getOciContext();
  const query = normalizeUsageQuery(rawQuery, {
    ...config,
    tenancyId: config.tenancyId || context.tenancyId
  });
  const cacheKey = JSON.stringify(query);
  const cached = cache.get(cacheKey);
  if (cached) return includeRows ? cached : withoutRows(cached);

  const items = await requestSummarizedUsage(context.client, query);
  const report = buildUsageReport(items, query);
  cache.set(cacheKey, report);
  return includeRows ? report : withoutRows(report);
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
