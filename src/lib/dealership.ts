import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  FALLBACK_DEALERSHIP_ADDRESS,
  FALLBACK_DEALERSHIP_NAME,
  FALLBACK_DEALERSHIP_PHONE,
  siteTitle,
} from "@/lib/brand";

export type DealershipProfile = {
  name: string;
  address: string;
  phone: string;
};

function nonempty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function profileFromSettingValue(value: string | null | undefined): DealershipProfile {
  let parsed: { name?: unknown; address?: unknown; phone?: unknown } = {};
  if (value) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = {};
    }
  }
  return {
    name: nonempty(parsed.name) ?? FALLBACK_DEALERSHIP_NAME,
    address: nonempty(parsed.address) ?? FALLBACK_DEALERSHIP_ADDRESS,
    phone: nonempty(parsed.phone) ?? FALLBACK_DEALERSHIP_PHONE,
  };
}

export const getDealershipProfile = cache(async (): Promise<DealershipProfile> => {
  const row = await prisma.setting.findUnique({ where: { key: "dealership" } });
  return profileFromSettingValue(row?.value);
});

export async function siteMetadata(page: string): Promise<{ title: string }> {
  const { name } = await getDealershipProfile();
  return { title: siteTitle(page, name) };
}
