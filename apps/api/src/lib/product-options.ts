import { Prisma } from '@fida/database/client';
type Option = { name: string; price: number; group?: string; minSelect?: number; maxSelect?: number };
const invalid = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export function normalizeOptions(value: unknown): Option[] {
 if (!Array.isArray(value) || value.length > 40) throw invalid('Supply up to 40 product choices.');
 const result: Option[] = value.map(raw => {
  if (!raw || typeof raw !== 'object') throw invalid('Invalid product choice.');
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const price = Number(o.price);
  if (!name || name.length > 160 || !Number.isFinite(price) || price < 0 || price > 1000000) throw invalid('Each choice needs a name and a nonnegative price.');
  const group = typeof o.group === 'string' ? o.group.trim() : '';
  if (!group) return {name, price};
  const minSelect = Number(o.minSelect ?? 0), maxSelect = Number(o.maxSelect ?? 1);
  if (group.length > 80 || !Number.isInteger(minSelect) || !Number.isInteger(maxSelect) || minSelect < 0 || maxSelect < 1 || maxSelect > 20 || minSelect > maxSelect) throw invalid('Invalid selection limits.');
  return {name, price, group, minSelect, maxSelect};
 });
 if (new Set(result.map(o => o.name)).size !== result.length) throw invalid('Choice names must be unique within a product.');
 for (const group of new Set(result.map(o => o.group).filter(Boolean))) {
  const rows = result.filter(o => o.group === group), first = rows[0]!;
  if (rows.some(o => o.minSelect !== first.minSelect || o.maxSelect !== first.maxSelect) || first.minSelect! > rows.length || first.maxSelect! > rows.length) throw invalid(`Check the choices and selection limits for ${group}.`);
 }
 return result;
}
export function selectedOptions(product: { price: Prisma.Decimal; options: unknown; name: string }, selected: unknown) {
 const names = selected ?? [];
 if (!Array.isArray(names) || names.length > 40 || names.some(v => typeof v !== 'string') || new Set(names).size !== names.length) throw invalid('Invalid product choices.');
 const options = Array.isArray(product.options) ? product.options as Option[] : [];
 let price = product.price;
 for (const name of names) {
  const option = options.find(o => o.name === name);
  if (!option) throw invalid('A product choice is no longer available.', 409);
  price = price.plus(option.price);
 }
 for (const group of new Set(options.map(o => o.group).filter(Boolean))) {
  const rows = options.filter(o => o.group === group), first = rows[0]!;
  const count = rows.filter(o => names.includes(o.name)).length;
  if (count < (first.minSelect ?? 0) || count > (first.maxSelect ?? rows.length)) throw invalid(`Choose ${first.minSelect ?? 0}–${first.maxSelect ?? rows.length} options for ${group}.`, 409);
 }
 return {price, name: product.name + (names.length ? ` (${names.join(', ')})` : '')};
}
