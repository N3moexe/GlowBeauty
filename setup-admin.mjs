#!/usr/bin/env node
import crypto from "crypto";
import mysql from "mysql2/promise";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha256")
    .toString("hex");
  return `${salt}:${hash}`;
}

function resolveDbConfig() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    let parsed;
    try {
      parsed = new URL(databaseUrl);
    } catch (error) {
      throw new Error(`Invalid DATABASE_URL: ${error.message}`);
    }

    const database = parsed.pathname.replace(/^\//, "");
    if (!database) {
      throw new Error("DATABASE_URL must include a database name.");
    }

    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username || "root"),
      password: decodeURIComponent(parsed.password || ""),
      database,
    };
  }

  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "senbonsplans",
  };
}

function toRows(result) {
  return Array.isArray(result) ? result : [];
}

async function main() {
  let connection;

  try {
    console.log("\n=== SenBonsPlans Admin Setup ===\n");

    const config = resolveDbConfig();
    console.log(
      `Connecting to MySQL ${config.host}:${config.port}/${config.database}...`
    );

    connection = await mysql.createConnection(config);
    console.log("Connected.\n");

    const defaultUsername =
      process.env.LOCAL_ADMIN_USERNAME || "admin@senbonsplans";
    const usernameInput = await ask(
      `Admin username [${defaultUsername}]: `
    );
    const username = usernameInput.trim() || defaultUsername;

    if (!username) {
      console.error("Username cannot be empty.");
      process.exitCode = 1;
      return;
    }

    const [existingResult] = await connection.execute(
      "SELECT id FROM admin_credentials WHERE username = ? LIMIT 1",
      [username]
    );
    const existingRows = toRows(existingResult);
    const existingCredential = existingRows[0];

    if (existingCredential) {
      const update = await ask(
        "Admin username already exists. Update password? (y/N): "
      );
      if (update.trim().toLowerCase() !== "y") {
        console.log("No changes made.");
        return;
      }
    }

    const password = await ask("Admin password (min 8 chars): ");
    if (password.length < 8) {
      console.error("Password must be at least 8 characters.");
      process.exitCode = 1;
      return;
    }

    const passwordConfirm = await ask("Confirm password: ");
    if (password !== passwordConfirm) {
      console.error("Passwords do not match.");
      process.exitCode = 1;
      return;
    }

    const [adminUsersResult] = await connection.execute(
      "SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1",
      ["admin"]
    );
    const adminUsers = toRows(adminUsersResult);

    let userId;
    if (adminUsers.length > 0) {
      userId = adminUsers[0].id;
      console.log(`Using admin user id=${userId}`);
    } else {
      const [anyUsersResult] = await connection.execute(
        "SELECT id FROM users ORDER BY id LIMIT 1"
      );
      const anyUsers = toRows(anyUsersResult);

      if (anyUsers.length > 0) {
        userId = anyUsers[0].id;
        console.log(
          `No users with role=admin found, using first user id=${userId}.`
        );
      } else {
        const fallback = Number(process.env.LOCAL_ADMIN_USER_ID || 1);
        userId = Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
        console.log(
          `No users found in DB, using fallback userId=${userId}.`
        );
      }
    }

    const passwordHash = hashPassword(password);

    if (existingCredential) {
      await connection.execute(
        "UPDATE admin_credentials SET userId = ?, passwordHash = ?, updatedAt = NOW() WHERE id = ?",
        [userId, passwordHash, existingCredential.id]
      );
      console.log("\nAdmin credential updated.");
    } else {
      await connection.execute(
        "INSERT INTO admin_credentials (userId, username, passwordHash) VALUES (?, ?, ?)",
        [userId, username, passwordHash]
      );
      console.log("\nAdmin credential created.");
    }

    console.log("\nLogin URL: /admin-login");
    console.log(`Username: ${username}`);
    console.log("Setup complete.\n");
  } catch (error) {
    console.error("\nSetup failed:", error.message || error);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
    rl.close();
  }
}

main();
