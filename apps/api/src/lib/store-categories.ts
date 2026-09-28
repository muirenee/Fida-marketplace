import {prisma} from '@fida/database/client';
export async function requireStoreCategory(code:unknown,db:Pick<typeof prisma,'storeCategory'>=prisma){
 if(typeof code!=='string'||!await db.storeCategory.findFirst({where:{code,isActive:true}}))throw Object.assign(new Error('Choose an active store category.'),{statusCode:400});
 return code as string;
}
export const initialStoreCategories=[{code:'RESTAURANT',name:'Restaurants',icon:'🍽️',sortOrder:10},{code:'SUPERMARKET',name:'Grocery',icon:'🛒',sortOrder:20},{code:'RETAIL',name:'Shops',icon:'🛍️',sortOrder:30},{code:'OTHER',name:'Other',icon:'🏪',sortOrder:40}];
