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
export type ChoiceSelection = {name:string;quantity:number};
export type ModifierLine = ChoiceSelection & {unitPrice:string;totalPrice:string};
export function selectedOptions(product: { price: Prisma.Decimal; options: unknown; name: string }, selected: unknown) {
 const raw = selected ?? [];
 if (!Array.isArray(raw) || raw.length > 40) throw invalid('Invalid product choices.');
 const choices:ChoiceSelection[]=raw.map(v=>{
  if(typeof v==='string')return {name:v,quantity:1}; // Installed 0.12 clients and historic snapshots.
  if(!v||typeof v!=='object'||typeof v.name!=='string'||!Number.isInteger(v.quantity)||v.quantity<1||v.quantity>20)throw invalid('Choice quantities must be integers from 1 to 20.');
  return {name:v.name,quantity:v.quantity};
 });
 if(new Set(choices.map(c=>c.name)).size!==choices.length)throw invalid('Duplicate product choices.');
 const options = Array.isArray(product.options) ? product.options as Option[] : [];
 let price = product.price;
 const modifierLines:ModifierLine[]=[];
 for (const choice of choices) {
  const option = options.find(o => o.name === choice.name);
  if (!option) throw invalid('A product choice is no longer available.', 409);
  if(option.price===0&&choice.quantity!==1)throw invalid('Free choices may be selected once.');
  const unitPrice=new Prisma.Decimal(option.price).toDecimalPlaces(2),totalPrice=unitPrice.mul(choice.quantity);
  price=price.plus(totalPrice);
  modifierLines.push({...choice,unitPrice:unitPrice.toString(),totalPrice:totalPrice.toString()});
 }
 for (const group of new Set(options.map(o => o.group).filter(Boolean))) {
  const rows = options.filter(o => o.group === group), first = rows[0]!;
  // Group limits constrain distinct selections, not units of a selected premium extra.
  const count = rows.filter(o => choices.some(c=>c.name===o.name)).length;
  if (count < (first.minSelect ?? 0) || count > (first.maxSelect ?? rows.length)) throw invalid(`Choose ${first.minSelect ?? 0}–${first.maxSelect ?? rows.length} options for ${group}.`, 409);
 }
 const names=choices.map(c=>c.quantity===1?c.name:`${c.quantity} × ${c.name}`);
 return {price,basePrice:product.price,modifierLines,selectedOptions:choices,name:product.name+(names.length?` (${names.join(', ')})`:'')};
}
