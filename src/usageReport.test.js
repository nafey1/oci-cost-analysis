import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUsageReport, reportToCsv } from './usageReport.js';

test('buildUsageReport aggregates costs and usage by requested group fields', () => {
  const report = buildUsageReport(
    [
      { service: 'Compute', region: 'us-ashburn-1', computedAmount: 10.123, quantity: 2, currency: 'USD' },
      { service: 'Compute', region: 'us-ashburn-1', computedAmount: 5.127, quantity: 3, currency: 'USD' },
      { service: 'Object Storage', region: 'us-phoenix-1', computedAmount: 2, quantity: 100, currency: 'USD' }
    ],
    { groupBy: ['region', 'service'] }
  );

  assert.equal(report.totals.cost, 17.25);
  assert.equal(report.totals.usage, 105);
  assert.equal(report.byGroup.length, 2);
  assert.deepEqual(report.byGroup[0], {
    region: 'us-ashburn-1',
    group: 'Compute',
    groupValues: {
      region: 'us-ashburn-1',
      service: 'Compute'
    },
    cost: 15.25,
    usage: 5,
    currency: 'USD',
    count: 2,
    percentOfCost: 15.25 / 17.25
  });
});

test('reportToCsv escapes grouped labels', () => {
  const csv = reportToCsv({
    byGroup: [
      { region: 'us-ashburn-1', group: 'Database, Exadata', cost: 12, usage: 1, currency: 'USD', percentOfCost: 1, count: 1 }
    ]
  });

  assert.match(csv, /^region,group,cost,usage,currency,percentOfCost,count\nus-ashburn-1,"Database, Exadata",12,1,USD,1,1\n$/);
});

test('buildUsageReport omits grouped rows with zero cost', () => {
  const report = buildUsageReport(
    [
      { service: 'Compute', region: 'us-ashburn-1', computedAmount: 10, computedQuantity: 2, currency: 'USD' },
      { service: 'DNS', region: 'us-ashburn-1', computedAmount: 0, computedQuantity: 12, currency: 'USD' }
    ],
    { groupBy: ['region', 'service'] }
  );

  assert.equal(report.byGroup.length, 1);
  assert.equal(report.byGroup[0].group, 'Compute');
});

test('buildUsageReport keeps sub-cent non-zero cost groups', () => {
  const report = buildUsageReport(
    [
      { service: 'Monitoring', region: 'us-ashburn-1', computedAmount: 0.004, computedQuantity: 1, currency: 'USD' },
      { service: 'DNS', region: 'us-ashburn-1', computedAmount: 0, computedQuantity: 1, currency: 'USD' }
    ],
    { groupBy: ['region', 'service'] }
  );

  assert.equal(report.totals.cost, 0);
  assert.equal(report.byGroup.length, 1);
  assert.equal(report.byGroup[0].group, 'Monitoring');
  assert.equal(report.byGroup[0].cost, 0.004);
});

test('buildUsageReport does not create cent-level drift in grouped totals', () => {
  const report = buildUsageReport(
    [
      { service: 'Compute', region: 'us-ashburn-1', computedAmount: 0.014, computedQuantity: 1, currency: 'USD' },
      { service: 'Storage', region: 'us-ashburn-1', computedAmount: 0.014, computedQuantity: 1, currency: 'USD' }
    ],
    { groupBy: ['region', 'service'] }
  );

  assert.equal(report.totals.cost, 0.03);
  assert.equal(report.byGroup.reduce((sum, row) => sum + row.cost, 0), 0.028);
});

test('buildUsageReport displays compartment paths from root', () => {
  const report = buildUsageReport(
    [
      { compartmentPath: 'Platform/Prod/App', region: 'us-ashburn-1', computedAmount: 1, computedQuantity: 1, currency: 'USD' }
    ],
    { groupBy: ['region', 'compartmentPath'] }
  );

  assert.equal(report.byGroup[0].group, 'root / Platform / Prod / App');
  assert.equal(report.byGroup[0].groupValues.compartmentPath, 'root / Platform / Prod / App');
});
