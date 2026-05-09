import * as usageapi from 'oci-usageapi';
import { performance } from 'node:perf_hooks';

export function createUsageClient(provider, regionId) {
  const client = new usageapi.UsageapiClient({ authenticationDetailsProvider: provider });
  client.regionId = regionId;
  return client;
}

export async function requestSummarizedUsage(client, query) {
  const details = {
    tenantId: query.tenantId,
    timeUsageStarted: new Date(`${query.start}T00:00:00.000Z`),
    timeUsageEnded: new Date(`${query.end}T00:00:00.000Z`),
    granularity: query.granularity,
    queryType: query.queryType,
    groupBy: query.groupBy
  };

  if (query.compartmentDepth !== undefined) {
    details.compartmentDepth = query.compartmentDepth;
  }

  const items = [];
  const metrics = {
    apiCalls: 0,
    requestBytes: 0,
    responseBytes: 0,
    ociLatencyMs: 0,
    pageLatenciesMs: [],
    rowsReturned: 0,
    operations: []
  };
  let page;

  do {
    const request = {
      requestSummarizedUsagesDetails: details,
      page
    };
    const startedAt = performance.now();
    const response = await client.requestSummarizedUsages({
      requestSummarizedUsagesDetails: details,
      page
    });
    const latencyMs = performance.now() - startedAt;
    const pageItems = response.usageAggregation?.items ?? [];

    metrics.apiCalls += 1;
    metrics.requestBytes += byteSize(request);
    metrics.responseBytes += byteSize({
      usageAggregation: response.usageAggregation,
      opcNextPage: response.opcNextPage
    });
    metrics.ociLatencyMs += latencyMs;
    metrics.pageLatenciesMs.push(roundMs(latencyMs));
    metrics.rowsReturned += pageItems.length;

    items.push(...pageItems);
    page = response.opcNextPage;
  } while (page);

  return {
    items,
    metrics: {
      ...metrics,
      ociLatencyMs: roundMs(metrics.ociLatencyMs),
      operations: [{
        operation: 'requestSummarizedUsages',
        calls: metrics.apiCalls,
        rowsReturned: metrics.rowsReturned,
        requestBytes: metrics.requestBytes,
        responseBytes: metrics.responseBytes,
        latencyMs: roundMs(metrics.ociLatencyMs)
      }]
    }
  };
}

function byteSize(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}

function roundMs(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
