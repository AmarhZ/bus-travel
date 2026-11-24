import { HttpError, json, readJson, withAdmin } from '@/lib/api';
import { createResource, listResource, resources } from '@/lib/resources';

function cfgOf(params) {
  const cfg = resources[params.resource];
  if (!cfg) throw new HttpError(404, 'Sumber data tidak ditemukan.');
  return cfg;
}

export const GET = withAdmin(async (_req, { params }) => {
  const cfg = cfgOf(await params);
  return json(await listResource(cfg));
});

export const POST = withAdmin(async (req, { params }) => {
  const cfg = cfgOf(await params);
  const row = await createResource(cfg, await readJson(req));
  return json(row, 201);
});
