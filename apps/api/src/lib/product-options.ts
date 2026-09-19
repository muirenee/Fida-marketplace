import { Prisma } from '@fida/database/client';
export function selectedOptions(product: { price: Prisma.Decimal; options: unknown; name: string }, selected: unknown) {
 if(selected===undefined||selected===null)return {price:product.price,name:product.name};
 if(!Array.isArray(selected)||selected.length>20||selected.some(v=>typeof v!=='string')||new Set(selected).size!==selected.length)throw Object.assign(new Error('Invalid product choices.'),{statusCode:400});
 const options=Array.isArray(product.options)?product.options as {name:string;price:number}[]:[];
 let price=product.price;
 for(const name of selected){const option=options.find(o=>o.name===name);if(!option)throw Object.assign(new Error('A product choice is no longer available.'),{statusCode:409});price=price.plus(option.price);}
 return {price,name:product.name+(selected.length?` (${selected.join(', ')})`:'')};
}
