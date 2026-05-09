import test from 'node:test';
import assert from 'node:assert/strict';
import { requestSummarizedUsage } from './usageClient.js';

test('requestSummarizedUsage reports pagination and payload metrics', async () => {
  const pages = [
    {
      usageAggregation: { items: [{ service: 'Compute' }, { service: 'Storage' }] },
      opcNextPage: 'next-page'
    },
    {
      usageAggregation: { items: [{ service: 'Database' }] }
    }
  ];
  const requests = [];
  const client = {
    async requestSummarizedUsages(request) {
      requests.push(request);
      return pages.shift();
    }
  };

  const result = await requestSummarizedUsage(client, {
    tenantId: 'ocid1.tenancy.oc1..example',
    start: '2026-02-01',
    end: '2026-03-01',
    granularity: 'DAILY',
    queryType: 'COST',
    groupBy: ['region', 'service']
  });

  assert.equal(result.items.length, 3);
  assert.equal(result.metrics.apiCalls, 2);
  assert.equal(result.metrics.rowsReturned, 3);
  assert.equal(requests[1].page, 'next-page');
  assert.ok(result.metrics.requestBytes > 0);
  assert.ok(result.metrics.responseBytes > 0);
  assert.equal(result.metrics.pageLatenciesMs.length, 2);
  assert.deepEqual(result.metrics.operations.map((operation) => operation.operation), ['requestSummarizedUsages']);
  assert.equal(result.metrics.operations[0].calls, 2);
  assert.equal(result.metrics.operations[0].rowsReturned, 3);
});
