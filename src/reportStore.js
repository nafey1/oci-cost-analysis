import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPORT_EXTENSION = '.json';
const LATEST_DASHBOARD_FILE = 'latest-dashboard.json';

export function reportStoreKey(query) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(query))
    .digest('hex');
}

export function createReportStore(options = {}) {
  const enabled = options.enabled !== false;
  const dataDir = path.resolve(options.dataDir || './data');
  const reportsDir = path.join(dataDir, 'reports');
  const latestDashboardPath = path.join(dataDir, LATEST_DASHBOARD_FILE);
  const maxReports = Math.max(1, Number.parseInt(options.maxReports || 250, 10));

  async function ensureReady() {
    if (!enabled) return false;
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(reportsDir, { recursive: true });
    return true;
  }

  function reportPath(key) {
    if (!/^[a-f0-9]{64}$/.test(key)) {
      const error = new Error('Invalid report store key.');
      error.statusCode = 400;
      throw error;
    }
    return path.join(reportsDir, `${key}${REPORT_EXTENSION}`);
  }

  return {
    enabled,
    dataDir,

    async get(key) {
      if (!await ensureReady()) return undefined;
      try {
        const body = await fs.readFile(reportPath(key), 'utf8');
        const stored = JSON.parse(body);
        if (!stored?.report) return undefined;
        return stored;
      } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async set(key, report) {
      if (!await ensureReady()) return undefined;
      const savedAt = new Date().toISOString();
      const target = reportPath(key);
      const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
      const stored = {
        key,
        savedAt,
        generatedAt: report.generatedAt,
        query: report.query,
        totals: report.totals,
        report: cleanReportForStorage(report)
      };

      await fs.writeFile(temp, `${JSON.stringify(stored)}\n`, { mode: 0o600 });
      await fs.rename(temp, target);
      await pruneReports(reportsDir, maxReports);
      return stored;
    },

    async getLatestDashboard() {
      if (!await ensureReady()) return undefined;
      try {
        const body = await fs.readFile(latestDashboardPath, 'utf8');
        const latest = JSON.parse(body);
        if (latest?.key) {
          const stored = await this.get(latest.key);
          if (stored) return stored;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      return newestStoredReport(reportsDir);
    },

    async setLatestDashboard(storedReport) {
      if (!await ensureReady()) return undefined;
      if (!storedReport?.key) return undefined;
      const latest = {
        key: storedReport.key,
        savedAt: storedReport.savedAt,
        generatedAt: storedReport.generatedAt,
        query: storedReport.query,
        totals: storedReport.totals
      };
      const temp = `${latestDashboardPath}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(temp, `${JSON.stringify(latest)}\n`, { mode: 0o600 });
      await fs.rename(temp, latestDashboardPath);
      return latest;
    }
  };
}

function cleanReportForStorage(report) {
  const { delivery, ...stored } = report;
  return stored;
}

async function pruneReports(reportsDir, maxReports) {
  const entries = await fs.readdir(reportsDir, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(REPORT_EXTENSION)) continue;
    const file = path.join(reportsDir, entry.name);
    const stats = await fs.stat(file);
    reports.push({ file, mtimeMs: stats.mtimeMs });
  }

  reports.sort((a, b) => b.mtimeMs - a.mtimeMs);
  await Promise.all(reports.slice(maxReports).map((report) => fs.unlink(report.file)));
}

async function newestStoredReport(reportsDir) {
  const entries = await fs.readdir(reportsDir, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(REPORT_EXTENSION)) continue;
    const file = path.join(reportsDir, entry.name);
    const stats = await fs.stat(file);
    reports.push({ file, mtimeMs: stats.mtimeMs });
  }

  reports.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const report of reports) {
    try {
      const stored = JSON.parse(await fs.readFile(report.file, 'utf8'));
      if (stored?.report) return stored;
    } catch {
      // Ignore unreadable persisted reports and keep looking for a usable one.
    }
  }
  return undefined;
}
