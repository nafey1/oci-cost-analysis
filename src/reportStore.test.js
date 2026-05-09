import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createReportStore, reportStoreKey } from './reportStore.js';

test('reportStoreKey creates a stable opaque key from a normalized query', () => {
  const query = {
    start: '2026-02-01',
    end: '2026-03-01',
    granularity: 'DAILY',
    queryType: 'COST',
    groupBy: ['region', 'service'],
    tenantId: 'ocid1.tenancy.oc1..example'
  };

  const key = reportStoreKey(query);
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key, reportStoreKey(query));
});

test('persistent report store writes and reloads usage reports', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oci-cost-report-store-'));
  const store = createReportStore({ dataDir, maxReports: 5 });
  const key = reportStoreKey({ start: '2026-02-01', end: '2026-03-01', groupBy: ['region', 'service'] });
  const report = {
    query: { start: '2026-02-01', end: '2026-03-01', groupBy: ['region', 'service'] },
    generatedAt: '2026-03-01T00:00:00.000Z',
    totals: { cost: 12.34, usage: 56, rowCount: 2 },
    byGroup: [{ region: 'us-ashburn-1', group: 'Compute', cost: 12.34, usage: 56, count: 2 }],
    rows: [{ service: 'Compute', computedAmount: 12.34 }]
  };

  try {
    const saved = await store.set(key, report);
    const reloaded = await store.get(key);

    assert.equal(saved.key, key);
    assert.equal(reloaded.key, key);
    assert.equal(reloaded.report.totals.cost, 12.34);
    assert.deepEqual(reloaded.report.rows, report.rows);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test('persistent report store tracks the latest dashboard report', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oci-cost-latest-report-'));
  const store = createReportStore({ dataDir, maxReports: 5 });
  const firstKey = reportStoreKey({ start: '2026-01-01', end: '2026-02-01', groupBy: ['region', 'service'] });
  const secondKey = reportStoreKey({ start: '2026-02-01', end: '2026-03-01', groupBy: ['region', 'service'] });

  try {
    const first = await store.set(firstKey, {
      query: { start: '2026-01-01', end: '2026-02-01' },
      generatedAt: '2026-02-01T00:00:00.000Z',
      totals: { cost: 1, rowCount: 1 },
      byGroup: []
    });
    await store.setLatestDashboard(first);

    const second = await store.set(secondKey, {
      query: { start: '2026-02-01', end: '2026-03-01' },
      generatedAt: '2026-03-01T00:00:00.000Z',
      totals: { cost: 2, rowCount: 2 },
      byGroup: []
    });
    await store.setLatestDashboard(second);

    const latest = await store.getLatestDashboard();
    assert.equal(latest.key, secondKey);
    assert.equal(latest.report.query.start, '2026-02-01');
    assert.equal(latest.report.totals.cost, 2);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test('persistent report store falls back to newest report without a latest pointer', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oci-cost-newest-report-'));
  const store = createReportStore({ dataDir, maxReports: 5 });
  const key = reportStoreKey({ start: '2026-04-01', end: '2026-05-01', groupBy: ['region', 'service'] });

  try {
    await store.set(key, {
      query: { start: '2026-04-01', end: '2026-05-01' },
      generatedAt: '2026-05-01T00:00:00.000Z',
      totals: { cost: 42, rowCount: 4 },
      byGroup: []
    });

    const latest = await store.getLatestDashboard();
    assert.equal(latest.key, key);
    assert.equal(latest.report.query.start, '2026-04-01');
    assert.equal(latest.report.totals.cost, 42);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
