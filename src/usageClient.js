import * as usageapi from 'oci-usageapi';

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
  let page;

  do {
    const response = await client.requestSummarizedUsages({
      requestSummarizedUsagesDetails: details,
      page
    });

    items.push(...(response.usageAggregation?.items ?? []));
    page = response.opcNextPage;
  } while (page);

  return items;
}
