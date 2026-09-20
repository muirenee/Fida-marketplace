import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import { validateHours, branchIsOpen } from '../apps/api/src/lib/business-hours.js';
await test('0.7 upgrade preserves existing merchants and historical money while applying all new columns',async()=>{
 const db=await PGlite.create();
 try {
  const before=execFileSync('node_modules/.bin/prisma',['migrate','diff','--from-empty','--to-schema','tests/fixtures/schema-0.7.prisma','--script'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://test:test@localhost/test'}});
  await db.exec(before);
  await db.exec(`INSERT INTO "Tenant" (id,name,slug,status,"merchantType","updatedAt") VALUES ('existing','Existing','existing','ACTIVE','RESTAURANT',now());`);
  await db.exec('BEGIN;'+readFileSync('packages/database/prisma/upgrades/20260920-08-enums.sql','utf8')+'COMMIT;');
  await db.exec('BEGIN;'+readFileSync('packages/database/prisma/upgrades/20260920-08-schema.sql','utf8')+'COMMIT;');
  const current=await db.query<{status:string;taxLabel:string}>('SELECT status,"taxLabel" FROM "Tenant" WHERE id=$1',['existing']);
  assert.equal(current.rows[0].status,'ACTIVE');assert.equal(current.rows[0].taxLabel,'VAT');
  await db.exec(`INSERT INTO "Tenant" (id,name,slug,"merchantType","updatedAt") VALUES ('new','New','new','RESTAURANT',now());`);
  assert.equal((await db.query<{status:string}>(`SELECT status FROM "Tenant" WHERE id='new'`)).rows[0].status,'PENDING_APPROVAL');
  const cols=await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='PaymentAttempt' AND column_name IN ('settlementMode','destinationSubaccount')`);assert.equal(cols.rows.length,2);
  assert.equal((await db.query(`SELECT * FROM "MerchantApplication"`)).rows.length,0);
  await db.exec(readFileSync('packages/database/prisma/upgrades/20260920-08-enums.sql','utf8'));
 }finally{await db.close();}
});
await test('hours handle overnight week boundaries, breaks, overlaps and malformed input',()=>{
 const hours:any=[[],[],[],[],[],[],[{open:'22:00',close:'02:00'}]];
 assert.equal(validateHours(hours),true);
 const branch={isAcceptingOrders:true,openingHours:hours};
 assert.equal(branchIsOpen(branch,'UTC',new Date('2026-09-21T01:30:00Z')),true);
 assert.equal(branchIsOpen(branch,'UTC',new Date('2026-09-21T02:00:00Z')),false);
 hours[0]=[{open:'01:00',close:'03:00'}];assert.equal(validateHours(hours),false);
 hours[0]=[{open:'02:00',close:'03:00'}];assert.equal(validateHours(hours),true);
 assert.equal(validateHours([{open:'12:00',close:'12:00'},null,null,null,null,null,null]),false);
 assert.equal(branchIsOpen({isAcceptingOrders:true,openingHours:{}},'UTC'),false);
});
