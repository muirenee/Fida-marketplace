import { Prisma } from '@fida/database/client';
export function driverPayout(operator:{driverBasePay:Prisma.Decimal|null;driverPerKmPay:Prisma.Decimal|null},distance:Prisma.Decimal|null){
 if(operator.driverBasePay===null || operator.driverPerKmPay===null)return null;
 if(distance===null && !operator.driverPerKmPay.isZero())return null;
 return operator.driverBasePay.plus(operator.driverPerKmPay.mul(distance??0)).toDecimalPlaces(2);
}
export function paySettings(body:Record<string,unknown>){
 const result:{driverBasePay:Prisma.Decimal|null;driverPerKmPay:Prisma.Decimal|null}={driverBasePay:null,driverPerKmPay:null};
 for(const key of ['driverBasePay','driverPerKmPay'] as const){
  if(body[key]===null)continue;
  const value=Number(body[key]);
  if(body[key]===undefined||!Number.isFinite(value)||value<0||value>1000000)throw Object.assign(new Error('Supply nonnegative base pay and per-kilometre pay, or clear both.'),{statusCode:400});
  result[key]=new Prisma.Decimal(value).toDecimalPlaces(2);
 }
 if((result.driverBasePay===null)!==(result.driverPerKmPay===null))throw Object.assign(new Error('Set or clear both pay rates together.'),{statusCode:400});
 return result;
}
