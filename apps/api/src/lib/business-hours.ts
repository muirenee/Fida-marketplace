export type Hours = ({ open: string; close: string } | null)[];
const time = (s: unknown) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function validateHours(value: unknown): value is Hours {
  return Array.isArray(value) && value.length === 7 && value.every(v => v === null || (typeof v === 'object' && time(v.open) && time(v.close) && v.open !== v.close));
}
export function branchIsOpen(branch: { isAcceptingOrders: boolean; closedUntil?: Date | null; openingHours?: unknown }, timezone: string, at = new Date()) {
  if (!branch.isAcceptingOrders || (branch.closedUntil && branch.closedUntil > at)) return false;
  if (!validateHours(branch.openingHours)) return true;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? '';
  const day = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(get('weekday'));
  const now = `${get('hour')}:${get('minute')}`;
  const today = branch.openingHours[day], previous = branch.openingHours[(day + 6) % 7];
  return Boolean((today && (today.open < today.close ? now >= today.open && now < today.close : now >= today.open)) || (previous && previous.open > previous.close && now < previous.close));
}
