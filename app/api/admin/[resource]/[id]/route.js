import { HttpError, json, readJson, withAdmin } from '@/lib/api';
import { deleteResource, resources, updateResource } from '@/lib/resources';

async function parse(ctx) {
  const { resource, id } = await ctx.params;
  const cfg = resources[resource];
  if (!cfg) throw new HttpError(404, 'Sumber data tidak ditemukan.');
  const n = Number(id);
  if (!Number.isInteger(n)) throw new HttpError(400, 'ID tidak valid.');
  return { cfg, id: n };
}

export const PUT = withAdmin(async (req, ctx) => {
  const { cfg, id } = await parse(ctx);
  return json(await updateResource(cfg, id, await readJson(req)));
});

export const DELETE = withAdmin(async (_req, ctx) => {
  const { cfg, id } = await parse(ctx);
  return json(await deleteResource(cfg, id));
});
