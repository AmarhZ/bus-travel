import { one } from '@/lib/db';
import { expireStale, getTakenSeats } from '@/lib/booking';
import { HttpError, handle, json } from '@/lib/api';

export const GET = handle(async (_req, { params }) => {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) throw new HttpError(400, 'ID tidak valid.');
  await expireStale();
  const bus = await one(
    `SELECT b.capacity, b.seat_layout FROM schedules s JOIN buses b ON b.id = s.bus_id WHERE s.id = $1::int`,
    [id],
  );
  if (!bus) throw new HttpError(404, 'Jadwal tidak ditemukan.');
  return json({ capacity: bus.capacity, layout: bus.seat_layout, taken: await getTakenSeats(id) });
});
