import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_GRANULARITIES = new Set(['DAILY', 'MONTHLY']);
const VALID_QUERY_TYPES = new Set(['COST', 'USAGE', 'USAGE_ONLY']);
export const MAX_COMPARTMENT_DEPTH = 5;

export const GROUP_BY_OPTIONS = [
  { value: 'service', label: 'Service' },
  { value: 'skuName', label: 'SKU Name' },
  { value: 'skuPartNumber', label: 'SKU Part Number' },
  { value: 'unit', label: 'Unit' },
  { value: 'compartmentName', label: 'Compartment Name' },
  { value: 'compartmentPath', label: 'Compartment Path' },
  { value: 'compartmentId', label: 'Compartment OCID' },
  { value: 'platform', label: 'Platform' },
  { value: 'region', label: 'Region' },
  { value: 'logicalAd', label: 'Logical AD' },
  { value: 'resourceId', label: 'Resource OCID' },
  { value: 'tenantId', label: 'Tenant OCID' },
  { value: 'tenantName', label: 'Tenant Name' },
  { value: 'tagNamespace', label: 'Tag Namespace' },
  { value: 'tagKey', label: 'Tag Key' },
  { value: 'tagValue', label: 'Tag Value' }
];

const VALID_GROUP_BY = new Set(GROUP_BY_OPTIONS.map((option) => option.value));

function env(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function intEnv(name, fallback) {
  const raw = env(name, String(fallback));
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getAppConfig() {
  const defaultWindow = lastWholeMonthWindow();
  return {
    port: intEnv('PORT', 3000),
    authMethod: env('OCI_AUTH_METHOD', 'config').toLowerCase(),
    configFile: path.resolve(env('OCI_CONFIG_FILE', '~/.oci/config').replace(/^~(?=$|\/)/, process.env.HOME ?? '')),
    profile: env('OCI_PROFILE', 'DEFAULT'),
    tenancyId: env('OCI_TENANCY_OCID'),
    usageRegion: env('OCI_USAGE_REGION', env('OCI_REGION', 'us-ashburn-1')),
    defaults: {
      start: env('DEFAULT_START_DATE', defaultWindow.start),
      end: env('DEFAULT_END_DATE', defaultWindow.end),
      granularity: env('DEFAULT_GRANULARITY', 'DAILY').toUpperCase(),
      queryType: env('DEFAULT_QUERY_TYPE', 'COST').toUpperCase(),
      groupBy: env('DEFAULT_GROUP_BY', 'service')
    },
    cacheTtlSeconds: intEnv('CACHE_TTL_SECONDS', 300)
  };
}

export function lastWholeMonthWindow(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

export function normalizeUsageQuery(input, config = getAppConfig()) {
  const query = {
    start: input.start || config.defaults.start,
    end: input.end || config.defaults.end,
    granularity: String(input.granularity || config.defaults.granularity).toUpperCase(),
    queryType: String(input.queryType || config.defaults.queryType).toUpperCase(),
    groupBy: parseList(input.groupBy || config.defaults.groupBy),
    compartmentDepth: input.compartmentDepth === undefined || input.compartmentDepth === ''
      ? undefined
      : Number.parseInt(input.compartmentDepth, 10),
    tenantId: input.tenantId || config.tenancyId
  };
  query.groupBy = withRequiredRegion(query.groupBy);

  const errors = [];
  if (!query.tenantId) errors.push('OCI_TENANCY_OCID or tenantId query parameter is required.');
  if (!ISO_DATE.test(query.start)) errors.push('start must be YYYY-MM-DD.');
  if (!ISO_DATE.test(query.end)) errors.push('end must be YYYY-MM-DD.');
  if (ISO_DATE.test(query.start) && ISO_DATE.test(query.end) && query.start >= query.end) {
    errors.push('start must be earlier than end.');
  }
  if (!VALID_GRANULARITIES.has(query.granularity)) {
    errors.push('granularity must be DAILY or MONTHLY.');
  }
  if (!VALID_QUERY_TYPES.has(query.queryType)) {
    errors.push('queryType must be COST, USAGE, or USAGE_ONLY.');
  }
  if (query.compartmentDepth !== undefined && (
    !Number.isInteger(query.compartmentDepth) ||
    query.compartmentDepth < 0 ||
    query.compartmentDepth > MAX_COMPARTMENT_DEPTH
  )) {
    errors.push(`compartmentDepth must be an integer from 0 to ${MAX_COMPARTMENT_DEPTH}.`);
  }
  if (!query.groupBy.length) errors.push('groupBy must contain at least one field.');
  const invalidGroupBy = query.groupBy.filter((field) => !VALID_GROUP_BY.has(field));
  if (invalidGroupBy.length) {
    errors.push(`Unsupported groupBy field(s): ${invalidGroupBy.join(', ')}.`);
  }

  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    throw error;
  }

  return query;
}

export function parseList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseList(item));
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function withRequiredRegion(groupBy) {
  const fields = groupBy.filter((field, index) => groupBy.indexOf(field) === index);
  return ['region', ...fields.filter((field) => field !== 'region')];
}
