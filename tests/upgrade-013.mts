import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {test} from 'node:test';
await test('0.13 migration is repeatable and preserves historical totals, choices and tax semantics',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(`CREATE TABLE "Order" (id text,subtotal numeric,tax numeric,total numeric); INSERT INTO "Order" VALUES ('old',1000,180,1180); CREATE TABLE "OrderItem" (id text,"selectedOptions" jsonb); INSERT INTO "OrderItem" VALUES ('old','["Rice"]'); CREATE TABLE "Promotion" ("discountType" text,"productId" text,"buyQuantity" integer,"getQuantity" integer,CONSTRAINT "Promotion_bogo_scope_check" CHECK ("buyQuantity"=1)); INSERT INTO "Promotion" VALUES ('BOGO','p',1,1);`);
  const sql=readFileSync('packages/database/prisma/upgrades/20260927-013-schema.sql','utf8');
  for(let i=0;i<2;i++)await db.exec('BEGIN;'+sql+'COMMIT;');
  const order=(await db.query<any>('SELECT * FROM "Order"')).rows[0];assert.equal(order.taxInclusive,false);assert.equal(Number(order.total),1180);assert.equal(Number(order.tax),180);
  const item=(await db.query<any>('SELECT * FROM "OrderItem"')).rows[0];assert.equal(item.isFreeReward,false);assert.deepEqual(item.selectedOptions,['Rice']);assert.equal(item.modifierLines,null);
  await db.exec('UPDATE "Promotion" SET "buyQuantity"=2');await db.exec('BEGIN;'+sql+'COMMIT;');
  for(const value of [0,51])await assert.rejects(db.exec(`UPDATE "Promotion" SET "buyQuantity"=${value}`),/Promotion_bogo_scope_check/);
  await assert.rejects(db.exec('UPDATE "Promotion" SET "getQuantity"=2'),/Promotion_bogo_scope_check/);
 }finally{await db.close();}
});
