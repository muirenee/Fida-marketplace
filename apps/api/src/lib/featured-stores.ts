import {prisma} from '@fida/database/client';
import {runtimeSettings} from './runtime-settings.js';
/** Last 30 days: completed non-refunded orders, then units sold, then rating and ID. */
export async function featuredStoreIds():Promise<string[]>{
 const settings=await runtimeSettings();
 const manual=(settings.FEATURED_STORE_IDS||'').split(',').map(v=>v.trim()).filter(Boolean);
 const eligible={status:'ACTIVE' as const,isAcceptingOrders:true,branches:{some:{isActive:true,isAcceptingOrders:true}},products:{some:{isActive:true,isAvailable:true,deletedAt:null,OR:[{categoryId:null},{category:{isActive:true,deletedAt:null}}]}}};
 if(settings.FEATURED_STORE_MODE==='MANUAL'){
  const rows=await prisma.tenant.findMany({where:{...eligible,id:{in:manual}},select:{id:true}});const active=new Set(rows.map(r=>r.id));return manual.filter(id=>active.has(id)).slice(0,12);
 }
 const rows=await prisma.$queryRaw<{id:string}[]>`
 SELECT t.id FROM "Tenant" t
 JOIN (SELECT o."tenantId",count(*) AS sales FROM "Order" o WHERE o.status='COMPLETED' AND o."paymentStatus" NOT IN ('REFUNDED','PARTIALLY_REFUNDED','FAILED') AND o."createdAt">=NOW()-INTERVAL '30 days' GROUP BY o."tenantId") s ON s."tenantId"=t.id
 LEFT JOIN (SELECT o."tenantId",sum(i.quantity) AS units FROM "Order" o JOIN "OrderItem" i ON i."orderId"=o.id WHERE o.status='COMPLETED' AND o."paymentStatus" NOT IN ('REFUNDED','PARTIALLY_REFUNDED','FAILED') AND o."createdAt">=NOW()-INTERVAL '30 days' GROUP BY o."tenantId") u ON u."tenantId"=t.id
 LEFT JOIN (SELECT "tenantId",avg(rating) AS rating FROM "Review" GROUP BY "tenantId") r ON r."tenantId"=t.id
 WHERE t.status='ACTIVE' AND t."isAcceptingOrders"=true
 AND EXISTS (SELECT 1 FROM "Branch" b WHERE b."tenantId"=t.id AND b."isActive" AND b."isAcceptingOrders")
 AND EXISTS (SELECT 1 FROM "Product" p WHERE p."tenantId"=t.id AND p."isActive" AND p."isAvailable" AND p."deletedAt" IS NULL AND (p."categoryId" IS NULL OR EXISTS(SELECT 1 FROM "Category" c WHERE c.id=p."categoryId" AND c."isActive" AND c."deletedAt" IS NULL)))
 ORDER BY s.sales DESC,COALESCE(u.units,0) DESC,COALESCE(r.rating,0) DESC,t.id ASC LIMIT 12`;
 return rows.map(r=>r.id);
}
