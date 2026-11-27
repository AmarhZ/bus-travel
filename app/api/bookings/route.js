import { createBooking } from '@/lib/booking';
import { handle, json, readJson } from '@/lib/api';
import { clientIp, rateLimit } from '@/lib/ratelimit';

export const POST = handle(async (req) => {
  // Maksimal 10 pemesanan per 10 menit per perangkat: cukup untuk pelanggan asli,
  // menyulitkan orang yang menahan banyak kursi dengan pesanan palsu.
  await rateLimit(`book:${clientIp(req)}`, {
    limit: 10,
    windowSec: 600,
    message: 'Terlalu banyak pemesanan dari perangkat ini.',
  });
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
