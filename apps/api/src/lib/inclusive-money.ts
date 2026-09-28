import {Prisma} from '@fida/database/client';
const zero=()=>new Prisma.Decimal(0);
// Allocate whole cents by largest remainder so no small line becomes negative.
export function allocateDiscount(amount:Prisma.Decimal, weights:Prisma.Decimal[]) {
 const total=weights.reduce((sum,w)=>sum.plus(w),zero());
 if(total.isZero())return weights.map(()=>zero());
 const exact=weights.map(w=>amount.mul(w).div(total));
 const result=exact.map(v=>v.toDecimalPlaces(2,Prisma.Decimal.ROUND_DOWN));
 const cents=amount.minus(result.reduce((sum,v)=>sum.plus(v),zero())).mul(100).toNumber();
 const ranking=exact.map((v,i)=>({i,fraction:v.minus(result[i])})).sort((a,b)=>b.fraction.comparedTo(a.fraction)||a.i-b.i);
 for(let n=0;n<Math.round(cents);n++)result[ranking[n].i]=result[ranking[n].i].plus('0.01');
 return result;
}
export function includedTax(gross:Prisma.Decimal,percent:Prisma.Decimal){
 return gross.minus(gross.div(new Prisma.Decimal(1).plus(percent.div(100)))).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
}
