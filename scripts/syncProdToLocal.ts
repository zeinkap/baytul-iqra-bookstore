#!/usr/bin/env ts-node
/**
 * Sync Production Database to Local
 * 
 * This script dumps data from your Neon production database and imports it
 * into your local PostgreSQL database.
 * 
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/syncProdToLocal.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Load production DATABASE_URL from .env.production
const envProdPath = path.join(process.cwd(), '.env.production');
const envLocalPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envProdPath)) {
  console.error('❌ .env.production file not found!');
  process.exit(1);
}

if (!fs.existsSync(envLocalPath)) {
  console.error('❌ .env file not found!');
  process.exit(1);
}

// Read DATABASE_URL from both files
const prodEnvContent = fs.readFileSync(envProdPath, 'utf-8');
const localEnvContent = fs.readFileSync(envLocalPath, 'utf-8');

const prodDbUrlMatch = prodEnvContent.match(/DATABASE_URL=(.+)/);
const localDbUrlMatch = localEnvContent.match(/DATABASE_URL=(.+)/);

if (!prodDbUrlMatch) {
  console.error('❌ DATABASE_URL not found in .env.production');
  process.exit(1);
}

if (!localDbUrlMatch) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

const prodDbUrl = prodDbUrlMatch[1].trim();
const localDbUrl = localDbUrlMatch[1].trim();

// Parse local database name from URL
const localDbMatch = localDbUrl.match(/\/([^/?]+)(\?|$)/);
if (!localDbMatch) {
  console.error('❌ Could not parse local database name from DATABASE_URL');
  process.exit(1);
}

const localDbName = localDbMatch[1];
const dumpFile = '/tmp/prod_data_sync.sql';

console.log('🔄 Syncing production data to local database...\n');
console.log(`📦 Production DB: ${prodDbUrl.replace(/:[^:@]+@/, ':***@')}`);
console.log(`💾 Local DB: ${localDbUrl}\n`);

try {
  // Step 1: Dump production data
  console.log('1️⃣  Dumping production data...');
  execSync(
    `pg_dump --data-only --no-owner --no-acl --inserts "${prodDbUrl}" > ${dumpFile}`,
    { stdio: 'inherit' }
  );
  console.log('✅ Production data dumped\n');

  // Step 2: Clear local database (delete all data, keep schema)
  console.log('2️⃣  Clearing local database...');
  execSync(
    `psql -d ${localDbName} -c "TRUNCATE TABLE \\"_BookCategories\\", \\"Book\\", \\"Category\\", \\"PromoCode\\", \\"Order\\" RESTART IDENTITY CASCADE;"`,
    { stdio: 'inherit' }
  );
  console.log('✅ Local database cleared\n');

  // Step 3: Import production data to local
  console.log('3️⃣  Importing production data to local...');
  execSync(
    `psql -d ${localDbName} < ${dumpFile}`,
    { stdio: 'inherit' }
  );
  console.log('✅ Production data imported\n');

  // Step 4: Clean up
  console.log('4️⃣  Cleaning up...');
  fs.unlinkSync(dumpFile);
  console.log('✅ Cleanup complete\n');

  // Step 5: Get counts
  console.log('📊 Verifying import...');
  const bookCount = execSync(`psql -d ${localDbName} -t -c "SELECT COUNT(*) FROM \\"Book\\";"`)
    .toString()
    .trim();
  const categoryCount = execSync(`psql -d ${localDbName} -t -c "SELECT COUNT(*) FROM \\"Category\\";"`)
    .toString()
    .trim();
  
  console.log(`   📚 Books: ${bookCount}`);
  console.log(`   🏷️  Categories: ${categoryCount}\n`);

  console.log('🎉 Sync complete! Restart your dev server to see the changes.');
} catch (error) {
  console.error('❌ Error during sync:', error);
  
  // Clean up on error
  if (fs.existsSync(dumpFile)) {
    fs.unlinkSync(dumpFile);
  }
  
  process.exit(1);
}

