import {prisma} from '@fida/database/client';
export async function publicPromotions<T extends {tenantId:string;productId:string|null;rewardProductId?:string|null;discountType:string;buyQuantity:number;getQuantity:number;maxDiscount:unknown;usedCount:number;maxUses:number}>(rows:T[]){
 const products=await prisma.product.findMany({where:{id:{in:rows.flatMap(p=>[p.productId,p.rewardProductId].filter((id):id is string=>!!id))},isActive:true,isAvailable:true,deletedAt:null,OR:[{categoryId:null},{category:{isActive:true,deletedAt:null}}]},select:{id:true,tenantId:true,name:true,price:true}});
 return rows.filter(p=>{
  if(p.usedCount>=p.maxUses)return false;
  if(!p.productId)return p.discountType!=='BOGO';
  const item=products.find(i=>i.id===p.productId&&i.tenantId===p.tenantId);
  const reward=p.rewardProductId?products.find(i=>i.id===p.rewardProductId&&i.tenantId===p.tenantId):item;
  return !!item&&(p.discountType!=='BOGO'||(p.buyQuantity>=1&&p.buyQuantity<=50&&p.getQuantity===1&&!!reward&&reward.price.gt(0)&&Number(p.maxDiscount)>=reward.price.toNumber()));
 }).map(p=>({...p,rewardProductName:products.find(i=>i.id===(p.rewardProductId??p.productId))?.name??null,productName:products.find(i=>i.id===p.productId)?.name??null}));
}
