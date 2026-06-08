/**
 * Format a GBP value as a pound-sterling string.
 * @param {number} value - Annual (or monthly if monthly=true) amount in GBP.
 * @param {{ monthly?: boolean }} [options]
 * @returns {string} e.g. "£25,413" or "−£1,486"
 */
export function formatGBP(value, { monthly = false } = {}) {
  const amount = monthly ? value : value;
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  const formatted = abs.toLocaleString('en-GB');
  return rounded < 0 ? `−£${formatted}` : `£${formatted}`;
}

/**
 * Format a fraction (0–1) as a percentage string.
 * @param {number} fraction - e.g. 0.68
 * @returns {string} e.g. "68%"
 */
export function formatPct(fraction) {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * Format a value that is already a percentage (0–100) as a percentage string.
 * @param {number} p - e.g. 68.4
 * @returns {string} e.g. "68%"
 */
export function formatPctFromPct(p) {
  return `${Math.round(p)}%`;
}
