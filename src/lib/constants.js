export const CARD_IMAGE_SIZES = ['small', 'normal', 'large'];
export const CARD_IMAGE_WIDTHS = { small: 160, normal: 230, large: 300 };

export const RARITY_LETTER = { common: 'C', uncommon: 'U', rare: 'R', mythic: 'M' };
export const VERTICAL_STEP = { arrowup: -1, w: -1, arrowdown: 1, s: 1, enter: 1 };
export const HORIZONTAL_STEP = { arrowleft: -1, a: -1, arrowright: 1, d: 1 };
export const EXCLUDED_SET_TYPES = new Set(['alchemy', 'token', 'art_series']);

/**
 * Formats a Card Kingdom buy price for display.
 * Returns an empty string for null or non-positive values (card not bought by CK).
 * @param {number|null} p - Raw price value from the CK pricelist.
 * @returns {string} Formatted price like "$1.25", or "" if unavailable.
 */
export function formatCKPrice(p) {
  if (p == null || p <= 0) return '';
  return `$${Number(p).toFixed(2)}`;
}
