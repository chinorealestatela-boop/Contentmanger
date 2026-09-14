// Shared pricing math for Quotes and Bookings — one source of truth so the
// Quote Builder, seed data, and any booking-price recalculation always
// agree on how a total is derived.

export type PricingInput = {
  baseRate: number;
  driverFee?: number;
  mileageFee?: number;
  additionalFees?: number;
  discount?: number;
  taxRate?: number; // e.g. 0.0975 for 9.75%
  depositRate?: number; // fraction of total collected as deposit, default 0.3
};

export type PricingResult = {
  baseRate: number;
  driverFee: number;
  mileageFee: number;
  additionalFees: number;
  discount: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  totalPrice: number;
  depositAmount: number;
  balanceDue: number;
};

export function computePricing(input: PricingInput): PricingResult {
  const baseRate = round2(input.baseRate ?? 0);
  const driverFee = round2(input.driverFee ?? 0);
  const mileageFee = round2(input.mileageFee ?? 0);
  const additionalFees = round2(input.additionalFees ?? 0);
  const discount = round2(input.discount ?? 0);
  const taxRate = input.taxRate ?? 0.0975;

  const preTax = Math.max(0, baseRate + driverFee + mileageFee + additionalFees - discount);
  const taxAmount = round2(preTax * taxRate);
  const totalPrice = round2(preTax + taxAmount);
  const depositAmount = round2(totalPrice * (input.depositRate ?? 0.3));
  const balanceDue = round2(totalPrice - depositAmount);

  return {
    baseRate,
    driverFee,
    mileageFee,
    additionalFees,
    discount,
    taxRate,
    subtotal: round2(preTax),
    taxAmount,
    totalPrice,
    depositAmount,
    balanceDue,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// Rough baseline hourly rates by vehicle type, used when a quote/booking
// doesn't have an explicit vehicle rate to pull from. Purely a sane
// default for the builder UI — always overridable by staff.
export const FALLBACK_HOURLY_RATE: Record<string, number> = {
  ROLLS_ROYCE: 450,
  BENTLEY: 375,
  MAYBACH: 350,
  LAMBORGHINI: 425,
  EXOTIC: 400,
  MERCEDES_SPRINTER: 195,
  CADILLAC_ESCALADE: 165,
  SEDAN: 135,
  SUV: 155,
  OTHER: 150,
};

export const DRIVER_HOURLY_FEE = 45;
export const MILEAGE_RATE_PER_MILE = 6.5;
