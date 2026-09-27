import {prisma} from '@fida/database/client';
export async function publicPromotions<T extends {tenantId:string;productId:string|null;discountType:string;buyQuantity:number;getQuantity:number;maxDiscount:unknown;usedCount:number;maxUses:number}>(rows:T[]){
 const products=await prisma.product.findMany({where:{id:{in:rows.flatMap(p=>p.productId?[p.productId]:[])},isActive:true,isAvailable:true,deletedAt:null,OR:[{categoryId:null},{category:{isActive:true,deletedAt:null}}]},select:{id:true,tenantId:true,name:true,price:true}});
 return rows.filter(p=>{
  if(p.usedCount>=p.maxUses)return false;
  if(!p.productId)return p.discountType!=='BOGO';
  const item=products.find(i=>i.id===p.productId&&i.tenantId===p.tenantId);
  return !!item&&(p.discountType!=='BOGO'||(p.buyQuantity>=1&&p.buyQuantity<=50&&p.getQuantity===1&&item.price.gt(0)&&Number(p.maxDiscount)>=item.price.toNumber()));
 }).map(p=>({...p,productName:products.find(i=>i.id===p.productId)?.name??null}));
}
