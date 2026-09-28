import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {test} from 'node:test';
await test('0.15 migration retains stores and prices and is repeatable after category edits',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(`CREATE TYPE "MerchantType" AS ENUM ('RESTAURANT','SUPERMARKET','PHARMACY','RETAIL','OTHER');CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY','PICKUP');CREATE TABLE "Tenant" (id text PRIMARY KEY,"merchantType" "MerchantType" NOT NULL);INSERT INTO "Tenant" VALUES ('old','PHARMACY');CREATE TABLE "Branch" (id text PRIMARY KEY);INSERT INTO "Branch" VALUES ('b');CREATE TABLE "Promotion" (id text PRIMARY KEY);CREATE TABLE "Order" (id text,total numeric,"fulfillmentType" "FulfillmentType");INSERT INTO "Order" VALUES ('o',1180,'PICKUP');`);
  const sql=readFileSync('packages/database/prisma/upgrades/20260928-015-schema.sql','utf8');
  await db.exec('BEGIN;'+sql+'COMMIT;');
  const store=(await db.query<any>('SELECT * FROM "Tenant"')).rows[0];assert.equal(store.merchantType,'OTHER');assert.equal(Number(store.deliveryMarkup),0);
  assert.equal((await db.query<any>('SELECT "dineOutEnabled" FROM "Branch"')).rows[0].dineOutEnabled,false);
  await db.exec(`DELETE FROM "StoreCategory" WHERE code='OTHER';UPDATE "StoreCategory" SET name='Custom restaurant name' WHERE code='RESTAURANT';INSERT INTO "Order" VALUES ('d',100,'DINE_OUT');`);
  await db.exec('BEGIN;'+sql+'COMMIT;');
  assert.equal((await db.query<any>('SELECT "merchantType" FROM "Tenant"')).rows[0].merchantType,null);
  assert.equal((await db.query<any>('SELECT name FROM "StoreCategory" WHERE code=\'RESTAURANT\'')).rows[0].name,'Custom restaurant name');
  assert.equal((await db.query<any>('SELECT * FROM "StoreCategory" WHERE code=\'OTHER\'')).rows.length,0);
  assert.equal(Number((await db.query<any>('SELECT total FROM "Order" WHERE id=\'o\'')).rows[0].total),1180);
  await assert.rejects(db.exec('UPDATE "Tenant" SET "deliveryMarkup"=-1'),/Tenant_deliveryMarkup_check/);
 }finally{await db.close();}
});
