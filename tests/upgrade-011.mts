import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {test} from 'node:test';
await test('0.11 additive migration is repeatable, preserves promotions and enforces BOGO scope',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(execFileSync('node_modules/.bin/prisma',['migrate','diff','--from-empty','--to-schema','tests/fixtures/schema-0.8.prisma','--script'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://test:test@localhost/test'}}));
  for(const file of ['20260920-09','20260921-010'])await db.exec(readFileSync(`packages/database/prisma/upgrades/${file}-schema.sql`,'utf8'));
  await db.exec(`INSERT INTO "Tenant" (id,name,slug,"merchantType","updatedAt") VALUES ('t','Store','store','RESTAURANT',now()); INSERT INTO "Promotion" (id,"tenantId",code,percent,"maxDiscount","expiresAt","updatedAt") VALUES ('p','t','SAVE10',10,500,now()+interval '1 day',now());`);
  const sql=readFileSync('packages/database/prisma/upgrades/20260922-011-schema.sql','utf8');
  assert.doesNotMatch(sql,/DROP|TRUNCATE|DELETE/i);
  for(let i=0;i<2;i++)await db.exec('BEGIN;'+sql+'COMMIT;');
  const result=await db.query<any>(`SELECT * FROM "Promotion" WHERE id='p'`);assert.equal(result.rows[0].percent,10);assert.equal(result.rows[0].buyQuantity,1);
  await assert.rejects(db.exec(`UPDATE "Promotion" SET "discountType"='BOGO' WHERE id='p'`),/Promotion_bogo_scope_check/);
  await db.exec(`UPDATE "Promotion" SET "discountType"='BOGO',"productId"='item' WHERE id='p'`);
  await assert.rejects(db.exec(`UPDATE "Promotion" SET "buyQuantity"=2 WHERE id='p'`),/Promotion_bogo_scope_check/);
 }finally{await db.close();}
});
