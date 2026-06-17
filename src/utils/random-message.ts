/**
 * Legacy pipe-separated random message picker.
 * Dashboard allows users to enter "msg1|msg2|msg3" and one is picked at random.
 */
export function pickRandomMessage(text: string | null): string | null {
  if (!text) return null;
  const parts = text
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts[Math.floor(Math.random() * parts.length)];
}
