import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

/**
 * On Windows, libSQL may retain an OS-level handle on the SQLite file until
 * the Vitest worker exits, even after `await client.close()`. Deleting the
 * directory inside `afterAll` then raises EPERM and fails an otherwise passing
 * suite. A detached child waits for that worker to exit before cleaning up.
 *
 * This does not retry deletion while the database is still open. On other
 * platforms cleanup remains immediate, so CI on Linux is unchanged.
 */
function cleanupTestDirectory(directory: string): void {
  if (process.platform !== "win32") {
    rmSync(directory, { recursive: true, force: true });
    return;
  }

  // The child owns no libSQL handles. Once its parent process is gone, Windows
  // releases the parent's file locks and the directory can be safely removed.
  const cleanupScript = `
    const { rmSync } = require("node:fs");
    const [directory, pidText] = process.argv.slice(1);
    const parentPid = Number(pidText);
    function waitForParentExit() {
      try {
        process.kill(parentPid, 0);
        setTimeout(waitForParentExit, 250);
      } catch {
        // A short grace period allows Windows to release the final handles.
        setTimeout(() => {
          try {
            rmSync(directory, {
              recursive: true,
              force: true,
              maxRetries: 20,
              retryDelay: 250,
            });
          } catch (error) {
            console.error("Failed to clean up test database:", directory, error);
            process.exitCode = 1;
          }
        }, 250);
      }
    }
    waitForParentExit();
  `;

  const child = spawn(
    process.execPath,
    ["-e", cleanupScript, directory, String(process.pid)],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.on("error", (error) => {
    // A launcher error should not hide the underlying failure on Windows.
    console.error("Could not schedule test database cleanup:", directory, error);
  });
  child.unref();
}

/**
 * Create an isolated SQLite file for each integration suite.
 * drizzle-kit push reads the current schema.ts via drizzle.config.ts.
 * A temporary file is required because the CLI runs in a separate process.
 */
export function createIsolatedTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "mh-integration-test-"));
  const url = `file:${join(directory, "test.sqlite")}`;
  try {
    execFileSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("../node_modules/drizzle-kit/bin.cjs", import.meta.url),
        ),
        "push",
        "--config",
        fileURLToPath(new URL("../drizzle.config.ts", import.meta.url)),
      ],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: { ...process.env, DB_FILE_NAME: url },
        stdio: "pipe",
        timeout: 30_000,
      },
    );
    const client = createClient({ url });
    return {
      client,
      db: drizzle({ client }),
      cleanup: () => cleanupTestDirectory(directory),
    };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

/** Reset all application tables, including tables added to schema.ts later. */
export async function resetTestDatabase(client: Client) {
  await client.execute("PRAGMA foreign_keys = OFF");
  try {
    const { rows } = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    for (const row of rows) {
      const name = String(row.name).replaceAll('"', '""');
      await client.execute(`DELETE FROM "${name}"`);
    }
    await client.execute("DELETE FROM sqlite_sequence");
  } finally {
    await client.execute("PRAGMA foreign_keys = ON");
  }
}
