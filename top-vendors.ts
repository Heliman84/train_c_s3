#!/usr/bin/env node

/*
 * top-vendors.ts — Print the top 5 vendors by total spend from the invoices
 * database built by pdf-to-db.ts.
 *
 * Usage:
 *   node top-vendors.ts [invoices.db]
 */

import fs from 'node:fs';
import path from 'node:path';
import { openDb, topVendorsBySpend } from './src/db.ts';
import { money } from './src/invoice.ts';

function main(): void {
  const [, , dbArg] = process.argv;
  const dbPath = path.resolve(dbArg ?? 'invoices.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: database not found: ${dbPath}`);
    console.error('Run pdf-to-db.ts first to build it.');
    process.exit(1);
  }

  const db = openDb(dbPath);
  let vendors;
  try {
    vendors = topVendorsBySpend(db, 5);
  } finally {
    db.close();
  }

  if (vendors.length === 0) {
    console.log('No invoices in the database.');
    return;
  }

  console.log('Top vendors by total spend:');
  vendors.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.vendor.padEnd(24)} ${money(v.total)}`);
  });
}

main();
