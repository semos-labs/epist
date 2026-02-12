import { spawn } from "bun";

export interface FzfFilterResult {
  success: boolean;
  paths: string[];
  error?: string;
}

/**
 * Cached file list for the current picker session.
 * Populated once by collectFiles(), reused by filterFiles().
 */
let _cachedFiles: string[] = [];

/**
 * Collect all files from a directory and cache them.
 * Called once when the picker opens.
 */
export async function collectFiles(cwd: string, maxDepth = 5): Promise<string[]> {
  try {
    const findProc = spawn(
      ["find", cwd, "-maxdepth", String(maxDepth), "-type", "f", "-not", "-name", ".*"],
      {
        stdout: "pipe",
        stderr: "ignore",
      }
    );

    const output = await new Response(findProc.stdout).text();
    await findProc.exited.catch(() => {});

    _cachedFiles = output.trim().split("\n").filter(Boolean);
    return _cachedFiles;
  } catch {
    _cachedFiles = [];
    return [];
  }
}

/**
 * Filter the cached file list using fzf --filter.
 * Nearly instant since no disk I/O is involved.
 */
export async function filterFiles(query: string, limit = 50): Promise<FzfFilterResult> {
  if (_cachedFiles.length === 0) {
    return { success: true, paths: [] };
  }

  if (!query.trim()) {
    return { success: true, paths: _cachedFiles.slice(0, limit) };
  }

  try {
    const fzfProc = spawn(["fzf", "--filter", query], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "ignore",
    });

    // Start reading stdout before writing (avoids pipe deadlock)
    const outputPromise = new Response(fzfProc.stdout).text();

    // Bun's stdin is a FileSink — use .write() and .end(), not getWriter()
    fzfProc.stdin.write(_cachedFiles.join("\n") + "\n");
    fzfProc.stdin.end();

    const [exitCode, output] = await Promise.all([fzfProc.exited, outputPromise]);

    // Exit code 1 = no matches (fine), 2 = error
    if (exitCode !== 0 && exitCode !== 1) {
      return { success: false, paths: [], error: `fzf exited with code ${exitCode}` };
    }

    const paths = output.trim().split("\n").filter(Boolean).slice(0, limit);
    return { success: true, paths };
  } catch (error) {
    return {
      success: false,
      paths: [],
      error: error instanceof Error ? error.message : "Failed to run fzf",
    };
  }
}

/**
 * Clear the cached file list (call when picker closes).
 */
export function clearFileCache() {
  _cachedFiles = [];
}

/**
 * Check if fzf is available on the system.
 */
export async function isFzfAvailable(): Promise<boolean> {
  try {
    const proc = spawn(["which", "fzf"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}
