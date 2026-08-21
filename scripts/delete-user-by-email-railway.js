#!/usr/bin/env node
"use strict";

const path = require("node:path");
const readline = require("node:readline");
const fallbackPrismaPath = path.resolve(
  process.cwd(),
  "apps",
  "api",
  "node_modules",
  "@prisma",
  "client"
);

function getPrismaClient() {
  try {
    return require("@prisma/client");
  } catch (_e) {
    return require(fallbackPrismaPath);
  }
}

const { PrismaClient } = getPrismaClient();

function usage() {
  console.log("Usage: node scripts/delete-user-by-email-railway.js <email>");
  process.exit(1);
}

function assertSafeIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe identifier: ${value}`);
  }
}

function askConfirmation(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const email = (process.argv[2] || "").trim();
  if (!email || !email.includes("@") || email.startsWith("--")) {
    usage();
  }

  if (!process.env.DATABASE_URL) {
    console.log(
      "⚠️  DATABASE_URL is not set in env; script may fail unless Prisma resolves env from API config."
    );
  }

  const prisma = new PrismaClient({ log: ["error", "warn"] });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, createdAt: true, is_active: true },
    });

    if (!user) {
      console.error(`❌ No user found for email: ${email}`);
      process.exit(1);
    }

    console.log("Found user:");
    console.log(`  id: ${user.id}`);
    console.log(`  email: ${user.email}`);
    console.log(`  role: ${user.role}`);
    console.log(`  createdAt: ${user.createdAt}`);
    console.log(`  active: ${user.is_active}`);

    const depColumns = await prisma.$queryRawUnsafe(`
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name IN ('user_id', 'userId')
      ORDER BY table_name, column_name
    `);

    const tableColumns = new Map();
    for (const row of depColumns) {
      const key = `${row.table_schema}.${row.table_name}`;
      if (row.table_name.toLowerCase() === "user") continue;
      if (!tableColumns.has(key)) {
        tableColumns.set(key, row.column_name);
      }
    }

    const affected = [];

    for (const [qualified, column] of tableColumns.entries()) {
      const [schema, table] = qualified.split(".");
      assertSafeIdentifier(schema);
      assertSafeIdentifier(table);
      assertSafeIdentifier(column);

      const result = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::BIGINT AS count FROM "${schema}"."${table}" WHERE "${column}" = '${user.id}'`
      );
      const count = Number(result?.[0]?.count ?? 0);
      if (count > 0) {
        affected.push({ schema, table, column, count });
      }
      console.log(`  ${schema}.${table}.${column} -> ${count}`);
    }

    if (affected.length === 0) {
      console.log("No dependent rows found in user_id/userId columns.");
    } else {
      console.log("Dependent rows that will be deleted first:");
      for (const row of affected) {
        console.log(`  ${row.schema}.${row.table}.${row.column}: ${row.count}`);
      }
    }

    const confirm = await askConfirmation(
      `\nType DELETE to confirm permanent deletion of ${email} and linked rows: `
    );
    if (confirm !== "DELETE") {
      console.log("Aborted.");
      process.exit(0);
    }

    await prisma.$transaction(async (tx) => {
      for (const row of affected) {
        await tx.$executeRawUnsafe(
          `DELETE FROM "${row.schema}"."${row.table}" WHERE "${row.column}" = '${user.id}'`
        );
      }

      await tx.user.delete({ where: { id: user.id } });
    });

    console.log(`✅ Deleted user: ${email}`);
    console.log(
      "If you get foreign key errors, reply and I’ll provide a tighter SQL-only delete script for remaining edge tables."
    );
  } catch (err) {
    console.error("❌ Delete failed:");
    console.error(err?.message || err);
    if (
      typeof err?.message === "string" &&
      (err.message.includes("Foreign key constraint") || err.message.includes("P2003"))
    ) {
      console.log(
        "💥 Likely blocked by non-cascade FK relationships. This script handles user_id/userId links first; some references may use other user-related columns."
      );
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
