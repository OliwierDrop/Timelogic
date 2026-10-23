export function minutesToParts(total: number) {
  const safe = Math.max(0, Math.min(24 * 60, total || 0));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function partsToMinutes(hours: number, minutes: number) {
  return Math.max(0, Math.min(24 * 60, hours * 60 + minutes));
}
