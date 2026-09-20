export type Window = { open: string; close: string };
export type Hours = (Window | Window[] | null)[];
const validTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
export function validateHours(value: unknown): value is Hours {
  if (!Array.isArray(value) || value.length !== 7) return false;
  const intervals: [number, number][] = [];
  for (let day = 0; day < 7; day++) {
    const windows = value[day] === null ? [] : Array.isArray(value[day]) ? value[day] : [value[day]];
    if (windows.length > 4) return false;
    for (const w of windows) {
      if (!w || typeof w !== 'object' || !validTime(w.open) || !validTime(w.close) || w.open === w.close) return false;
      const start = day * 1440 + minutes(w.open);
      const end = day * 1440 + minutes(w.close) + (w.close < w.open ? 1440 : 0);
      intervals.push([start, Math.min(end, 10080)]);
      if (end > 10080) intervals.push([0, end - 10080]);
    }
  }
  intervals.sort((a,b) => a[0] - b[0]);
  return intervals.every((v,i) => i === 0 || v[0] >= intervals[i-1][1]);
}
export function branchIsOpen(branch: { isAcceptingOrders: boolean; closedUntil?: Date | null; openingHours?: unknown }, timezone: string, at = new Date()) {
  if (!branch.isAcceptingOrders || (branch.closedUntil && branch.closedUntil > at)) return false;
  if (branch.openingHours == null) return true;
  if (!validateHours(branch.openingHours)) return false;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? '';
  const day = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(get('weekday'));
  const now = `${get('hour')}:${get('minute')}`;
  const windows = (d: number): Window[] => { const v = (branch.openingHours as Hours)[d]; return v === null ? [] : Array.isArray(v) ? v : [v]; };
  return windows(day).some(w => w.open < w.close ? now >= w.open && now < w.close : now >= w.open)
    || windows((day + 6) % 7).some(w => w.open > w.close && now < w.close);
}
