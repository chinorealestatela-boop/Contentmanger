import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function listQuotes(filters: { q?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const where: Prisma.QuoteWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? { OR: [{ quoteNumber: { contains: filters.q } }, { customer: { OR: [{ firstName: { contains: filters.q } }, { lastName: { contains: filters.q } }] } }] }
      : {}),
  };

  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({ where, include: { customer: true, vehicle: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.quote.count({ where }),
  ]);

  return { quotes, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getQuoteDetail(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: { customer: true, vehicle: true, driver: true, lead: true, createdBy: true, convertedBooking: true, payments: true },
  });
}
