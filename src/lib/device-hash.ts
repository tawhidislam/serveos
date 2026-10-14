/**
 * Stable, anonymous per-browser identifier used to count "unique devices"
 * in QR scan analytics. It is a random opaque id stored locally — it carries
 * no personal data and never leaves the device except as this opaque string.
 */
const KEY = 'qr_device_id';

export function getDeviceHash(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return 'anonymous';
  }
}
