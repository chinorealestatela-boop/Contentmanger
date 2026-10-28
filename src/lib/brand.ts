// Public dealership branding fallbacks. Live name/address/phone come from
// the "dealership" settings row (see getDealershipProfile); these are used
// only when that row is missing or a field is blank.

export const FALLBACK_DEALERSHIP_NAME = "H&H Autos";
export const FALLBACK_DEALERSHIP_ADDRESS = "3112 E Fremont St, Las Vegas, NV 89104";
export const FALLBACK_DEALERSHIP_PHONE = "702-325-3898";

export function siteTitle(page: string, dealershipName: string = FALLBACK_DEALERSHIP_NAME): string {
  return `${page} | ${dealershipName}`;
}

/** Single-letter mark for the public header/footer. */
export function dealershipMonogram(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter >= "A" && letter <= "Z" ? letter : "H";
}
