import { createBooking } from '@/lib/booking';
import { handle, json, readJson } from '@/lib/api';

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const result = await createBooking({
    scheduleId: Number(body.scheduleId),
    customerName: body.customerName,
    phone: body.phone,
    email: body.email,
    seats: body.seats,
    method: body.method,
    paid: false, // pemesanan online selalu menunggu pembayaran
  });
  return json(result, 201);
});
