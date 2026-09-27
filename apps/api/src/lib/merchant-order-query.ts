import {OrderStatus,Prisma} from '@fida/database/client';
export const activeOrderStatuses:OrderStatus[]=['PENDING','ACCEPTED','PREPARING','READY_FOR_PICKUP','PICKED_UP','DELIVERING'];
export function merchantOrderWhere(tenantId:string,branchId:string|null|undefined,query:Record<string,unknown>,ignoreStatus=false):Prisma.OrderWhereInput {
 const status=typeof query.status==='string'?query.status.toUpperCase():null;
 if(status&&!['ACTIVE','HISTORY','PROCESSING',...Object.values(OrderStatus)].includes(status))throw Object.assign(new Error('Invalid order status.'),{statusCode:400});
 if(query.q!==undefined&&(typeof query.q!=='string'||query.q.length>100))throw Object.assign(new Error('invalid_order_search: Search must contain at most 100 characters.'),{statusCode:400});
 const search=typeof query.q==='string'?query.q.trim().replace(/\s+/g,' '):'';
 const literal=(value:string)=>value.replace(/[\\%_]/g,'\\$&');
 const scope=ignoreStatus||!status?{}:status==='ACTIVE'?{status:{in:activeOrderStatuses}}:status==='HISTORY'?{status:{in:['COMPLETED','CANCELLED','REJECTED'] as OrderStatus[]}}:status==='PROCESSING'?{status:{in:['ACCEPTED','PREPARING'] as OrderStatus[]}}:{status:status as OrderStatus};
 return {tenantId,...(branchId?{branchId}:{}),...scope,...(search?{OR:[{orderNumber:{contains:literal(search),mode:'insensitive'}},{customer:{AND:search.split(' ').map(word=>({OR:[{firstName:{contains:literal(word),mode:'insensitive'}},{lastName:{contains:literal(word),mode:'insensitive'}}]}))}}]}:{})};
}
