/**
 * Deterministic number and currency formatting for quantitative readouts.
 * Avoids environment-specific locale divergences between Node.js SSR and Browser hydration.
 */

export function formatINR(val: number): string {
  if (isNaN(val) || !isFinite(val)) return '0.00';
  const parts = val.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  const lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }
  return `${integerPart}.${decimalPart}`;
}

export function formatIntegerINR(val: number): string {
  if (isNaN(val) || !isFinite(val)) return '0';
  const integerPart = Math.round(val).toString();
  const lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }
  return integerPart;
}
