# OCI Cost Analysis

Node.js dashboard and API for reading Oracle Cloud Infrastructure cost and usage data from the OCI Usage API. The app uses the `DEFAULT` OCI CLI profile by default, summarizes tenancy usage, exports CSV/Excel, and presents interactive cost analytics in a browser UI.

## What This App Provides

- OCI Usage API integration with config-file, instance-principal, or resource-principal authentication.
- Default analysis window set to the last complete calendar month.
- Cost and usage reporting by region, service, SKU, compartment, platform, resource, tags, and other supported grouping fields.
- Grouped Usage table with multi-select filters, searchable column filters, adjustable column widths, region coloring, and filtered grand totals.
- Interactive ECharts dashboards for regional cost, cost drivers, service/region matrix, compartment depth, SKU Pareto, cost composition, daily trends, service/SKU cards, and long-tail SKU exploration.
- CSV export for API/table data and Excel export for the filtered dashboard table.
- Docker support without baking OCI credentials into the image.

## Architecture

The application is intentionally simple:

- `src/server.js` runs an Express server, static dashboard, API routes, CSV export, and Excel export.
- `src/ociAuth.js` creates the OCI authentication provider.
- `src/usageClient.js` calls `requestSummarizedUsages` and follows OCI pagination.
- `src/usageReport.js` normalizes OCI Usage API rows into dashboard/API summaries.
- `src/config.js` centralizes environment config, defaults, grouping options, and query validation.
- `public/` contains the browser UI, ECharts rendering, styles, and OCI logo.

The app is stateless. It uses a short in-memory TTL cache only to avoid accidental refresh storms. There is no database, and reports are generated from OCI Usage API responses.

## OCI Start

### 1. Confirm OCI Permissions

The identity running this app must be allowed to read tenancy usage reports. A common tenancy-level policy for a user group is:

```text
Allow group <group-name> to read usage-reports in tenancy
```

For instance principal or resource principal deployments, use a dynamic group policy with the same usage-report access intent:

```text
Allow dynamic-group <dynamic-group-name> to read usage-reports in tenancy
```

Do not skip this. OCI authentication can succeed while usage queries still fail if the policy is missing.

### 2. Configure OCI CLI Credentials

For local development, create or verify your OCI CLI config:

```bash
oci setup config
```

The app defaults to:

```text
OCI_CONFIG_FILE=~/.oci/config
OCI_PROFILE=DEFAULT
OCI_AUTH_METHOD=config
```

The selected OCI profile should include:

```ini
[DEFAULT]
user=ocid1.user.oc1...
fingerprint=...
tenancy=ocid1.tenancy.oc1...
region=us-ashburn-1
key_file=/Users/<you>/.oci/oci_api_key.pem
```

With config-file authentication, the tenancy OCID is inferred from the profile. `OCI_TENANCY_OCID` is optional unless you want to override it.

### 3. Pick the Usage API Region

Set `OCI_USAGE_REGION` to the tenancy home region by default. OCI Cost Analysis usage queries are served from the tenancy home region, so picking an arbitrary region is a bad assumption even when the report includes usage from many regions. Example:

```text
OCI_USAGE_REGION=us-ashburn-1
```

This region is used for the Usage API client endpoint. It does not limit the report to that region; reported usage can still include multiple OCI regions.

## Local Running The App

### Prerequisites

- Node.js 20 or newer.
- npm.
- OCI CLI config under `~/.oci/config`, or another supported OCI auth method.
- OCI policy granting usage report access.

### Install Node.js If Needed

Check whether Node.js and npm are already installed:

```bash
node --version
npm --version
```

If Node.js is missing or older than version 20, install a current LTS release from the official Node.js distribution or your operating system package manager. On macOS with Homebrew:

```bash
brew install node
```

With `nvm`:

```bash
nvm install --lts
nvm use --lts
```

### Setup

```bash
git clone https://github.com/nafey1/OCI-Cost-Analysis.git
cd OCI-Cost-Analysis
cp .env.example .env
npm install
```

Review `.env` and adjust the values that matter for your environment:

```text
PORT=3000
OCI_AUTH_METHOD=config
OCI_CONFIG_FILE=~/.oci/config
OCI_PROFILE=DEFAULT
OCI_USAGE_REGION=us-ashburn-1
DEFAULT_GRANULARITY=DAILY
DEFAULT_QUERY_TYPE=COST
DEFAULT_GROUP_BY=service
CACHE_TTL_SECONDS=300
```

Start the server:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Run tests:

```bash
npm test
```

## Docker

The image is designed so OCI secrets stay outside the container. Build the image:

```bash
docker build -t oci-cost-analysis .
```

### Run With Local OCI Config Mounted From Host

This is the normal local Docker workflow. The host keeps the OCI config and API key; the container reads them through a read-only bind mount.

```bash
docker run --rm \
  --name oci-cost-analysis \
  -p 3000:3000 \
  --env-file .env \
  -e OCI_AUTH_METHOD=config \
  -e OCI_CONFIG_FILE=/home/node/.oci/config \
  -e OCI_PROFILE=DEFAULT \
  -v "$HOME/.oci:/home/node/.oci:ro" \
  oci-cost-analysis
```

Open:

```text
http://localhost:3000
```

### Host Volume Mount For Persistence

The app itself is stateless. The important persistence boundary is OCI configuration and keys. Keep them on the host and mount them into the container:

```bash
mkdir -p "$HOME/.oci"

docker run --rm \
  --name oci-cost-analysis \
  -p 3000:3000 \
  --env-file .env \
  -e OCI_AUTH_METHOD=config \
  -e OCI_CONFIG_FILE=/home/node/.oci/config \
  -e OCI_PROFILE=DEFAULT \
  -v "$HOME/.oci:/home/node/.oci:ro" \
  oci-cost-analysis
```

If you want the environment file outside the image as a host-managed file, keep `.env` on the host and pass it with `--env-file .env`. Do not copy private keys into the Docker image.

### Docker Compose Example

```yaml
services:
  oci-cost-analysis:
    build: .
    image: oci-cost-analysis:latest
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      OCI_AUTH_METHOD: config
      OCI_CONFIG_FILE: /home/node/.oci/config
      OCI_PROFILE: DEFAULT
    volumes:
      - ${HOME}/.oci:/home/node/.oci:ro
    restart: unless-stopped
```

### OCI-Hosted Container Authentication

For an OCI Compute instance, use instance principal:

```bash
docker run --rm \
  --name oci-cost-analysis \
  -p 3000:3000 \
  -e OCI_AUTH_METHOD=instance_principal \
  -e OCI_TENANCY_OCID=ocid1.tenancy.oc1..example \
  -e OCI_USAGE_REGION=us-ashburn-1 \
  oci-cost-analysis
```

For OCI services that expose resource principal credentials, use:

```text
OCI_AUTH_METHOD=resource_principal
```

## Configuration Reference

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port used by the Express server. |
| `OCI_AUTH_METHOD` | `config` | `config`, `instance_principal`, or `resource_principal`. |
| `OCI_CONFIG_FILE` | `~/.oci/config` | OCI config file path for config-file auth. |
| `OCI_PROFILE` | `DEFAULT` | OCI profile name. |
| `OCI_TENANCY_OCID` | empty | Optional for config-file auth; required when tenancy cannot be inferred. |
| `OCI_USAGE_REGION` | `us-ashburn-1` | Region used for the OCI Usage API client. |
| `DEFAULT_START_DATE` | last whole month start | Optional dashboard/API default start date, inclusive. |
| `DEFAULT_END_DATE` | current month start | Optional dashboard/API default end date, exclusive. |
| `DEFAULT_GRANULARITY` | `DAILY` | `DAILY` or `MONTHLY`. |
| `DEFAULT_QUERY_TYPE` | `COST` | `COST`, `USAGE`, or `USAGE_ONLY`. |
| `DEFAULT_GROUP_BY` | `service` | Comma-separated default grouping fields. |
| `CACHE_TTL_SECONDS` | `300` | In-memory report cache TTL. Use `0` to disable. |

## Date Window Rules

- `start` is inclusive.
- `end` is exclusive.
- For a complete month, use the first day of the month as `start` and the first day of the next month as `end`.
- Example for February 2025:

```text
start=2025-02-01
end=2025-03-01
```

If the dashboard Start date is changed to a date later than End, the End date is cleared to prevent an invalid query.

## Dashboard Notes

- Grouped Usage only displays non-zero cost groups.
- Region is always included as the first grouped dimension for the dashboard table.
- Compartment hierarchy is displayed from root and can be limited with the Compartment Depth selector through level 5.
- Table filters are multi-select and searchable. Grand totals update as filters change.
- CSV export uses the current query. Excel export from the dashboard uses the currently filtered visible table.
- Charts use a shared color language across services, regions, and SKU views where applicable.

## API

### `GET /api/defaults`

Returns effective defaults, selected OCI profile, auth method, Usage API region, available Group By fields, and tenancy discovery status.

### `GET /api/usage`

Query parameters:

| Parameter | Description |
| --- | --- |
| `start` | Inclusive start date, `YYYY-MM-DD`. |
| `end` | Exclusive end date, `YYYY-MM-DD`. |
| `granularity` | `DAILY` or `MONTHLY`. |
| `queryType` | `COST`, `USAGE`, or `USAGE_ONLY`. |
| `groupBy` | Comma-separated group fields, for example `service,skuName`. |
| `compartmentDepth` | Optional integer from `0` through `5`. |
| `tenantId` | Optional tenancy OCID override. |
| `includeRows` | Set to `true` to include raw OCI rows in the JSON response. |

Example:

```bash
curl "http://localhost:3000/api/usage?start=2025-02-01&end=2025-03-01&granularity=DAILY&queryType=COST&groupBy=service,skuName"
```

### `GET /api/usage.csv`

Returns grouped usage as CSV for the same query parameters supported by `/api/usage`.

### `GET /api/usage.xlsx`

Returns grouped usage as an Excel workbook for the same query parameters supported by `/api/usage`.

### `POST /api/usage.xlsx`

Used by the browser dashboard to export the currently filtered visible table to Excel.

### `GET /healthz`

Simple health check:

```json
{"ok":true}
```

## Supported Group By Fields

- `service`
- `skuName`
- `skuPartNumber`
- `unit`
- `compartmentName`
- `compartmentPath`
- `compartmentId`
- `platform`
- `region`
- `logicalAd`
- `resourceId`
- `tenantId`
- `tenantName`
- `tagNamespace`
- `tagKey`
- `tagValue`

## Security Notes

- Do not commit `.env`, OCI private keys, or `~/.oci` contents.
- Mount OCI config and keys read-only in Docker.
- Prefer instance principal or resource principal for OCI-hosted deployments.
- Treat exported cost reports as sensitive financial data.
- Validate OCI IAM policy scope before exposing the dashboard beyond a trusted network.

## Troubleshooting

### `OCI_TENANCY_OCID or tenantId query parameter is required`

The app could not infer the tenancy OCID. Either verify the selected OCI profile has a `tenancy` value or set:

```text
OCI_TENANCY_OCID=ocid1.tenancy.oc1...
```

### Usage Query Returns Authorization Errors

Authentication succeeded, but IAM policy is missing or too narrow. Add usage-report read access for the user group or dynamic group.

### No Chart Data For A Date Window

The dashboard intentionally hides zero-cost grouped rows. If OCI returns only zero-cost rows for the selected window, charts will be empty and the status message will call that out.

### Docker Cannot Find The OCI Key

Check that `key_file` inside the mounted config points to a path that exists inside the container. The safest pattern is to keep the key under `$HOME/.oci` and mount that directory to `/home/node/.oci`.

## Recent Updates

- Added a richer OCI cost dashboard with ECharts-based analytics and shared visual styling.
- Added Grouped Usage multi-select filters, searchable column filters, adjustable widths, region coloring, and live grand totals.
- Added CSV and Excel export paths, including Excel export for the currently filtered dashboard table.
- Added summary panels for billing period, unique SKUs, active regions, daily average, and peak daily cost.
- Added daily cost explorer views, service/SKU cards, compartment depth charting, SKU Pareto, cost composition, and long-tail SKU visualization.
- Added theme selection, OCI branding, chart download buttons, and chart/table tooltips.
- Limited compartment depth filtering to level 5 and clarified inclusive/exclusive analysis dates.
- Improved date validation by clearing End when Start is changed beyond it.
