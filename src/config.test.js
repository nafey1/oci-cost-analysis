import test from 'node:test';
import assert from 'node:assert/strict';
import { lastWholeMonthWindow, normalizeUsageQuery } from './config.js';

test('lastWholeMonthWindow returns the previous complete calendar month', () => {
  assert.deepEqual(lastWholeMonthWindow(new Date('2026-05-07T12:00:00Z')), {
    start: '2026-04-01',
    end: '2026-05-01'
  });
});

test('lastWholeMonthWindow handles January year rollover', () => {
  assert.deepEqual(lastWholeMonthWindow(new Date('2026-01-15T12:00:00Z')), {
    start: '2025-12-01',
    end: '2026-01-01'
  });
});

test('normalizeUsageQuery limits compartment depth to five hierarchy levels', () => {
  assert.throws(
    () => normalizeUsageQuery(
      { start: '2025-02-01', end: '2025-03-01', compartmentDepth: '6' },
      {
        defaults: {
          start: '2025-02-01',
          end: '2025-03-01',
          granularity: 'DAILY',
          queryType: 'COST',
          groupBy: 'service'
        },
        tenancyId: 'ocid1.tenancy.oc1..example'
      }
    ),
    /compartmentDepth must be an integer from 0 to 5/
  );
});
