import { spawn } from "bun";
import { join } from "path";

// Detect platform
const platform = process.platform;

/**
 * Open a file with the system's default application
 * Cross-platform: macOS (open), Linux (xdg-open), Windows (start)
 */
export async function openFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    let command: string;
    let args: string[];

    switch (platform) {
      case "darwin":
        command = "open";
        args = [filePath];
        break;
      case "win32":
        command = "cmd";
        args = ["/c", "start", "", filePath];
        break;
      default: // Linux and others
        command = "xdg-open";
        args = [filePath];
        break;
    }

    const proc = spawn([command, ...args], {
      stdout: "ignore",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return { success: false, error: stderr || `Exit code: ${exitCode}` };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Preview a file using macOS Quick Look (qlmanage -p).
 * Falls back to openFile() on non-macOS platforms.
 * Quick Look opens a lightweight preview window that dismisses on any key/click.
 */
export async function quickLook(filePath: string): Promise<{ success: boolean; error?: string }> {
  if (platform !== "darwin") {
    return openFile(filePath);
  }

  try {
    const proc = spawn(["qlmanage", "-p", filePath], {
      stdout: "ignore",
      stderr: "ignore",
    });

    // qlmanage blocks until the preview is dismissed — don't await it
    // so the TUI stays responsive. Just fire and forget.
    proc.exited.catch(() => {});

    // Bring the Quick Look window above all other windows after a short delay
    // (qlmanage needs a moment to create its window)
    setTimeout(() => {
      spawn([
        "osascript", "-e",
        'tell application "System Events" to set frontmost of process "qlmanage" to true',
      ], { stdout: "ignore", stderr: "ignore" });
    }, 50);

    return { success: true };
  } catch (error) {
    // Fallback to regular open if qlmanage isn't available
    return openFile(filePath);
  }
}

/**
 * Save/copy a file to a destination directory
 */
export async function saveFile(
  sourcePath: string, 
  destDir: string, 
  filename?: string
): Promise<{ success: boolean; savedPath?: string; error?: string }> {
  try {
    const sourceFile = Bun.file(sourcePath);
    
    if (!await sourceFile.exists()) {
      return { success: false, error: "Source file does not exist" };
    }

    const destFilename = filename || sourcePath.split("/").pop() || "attachment";
    const destPath = join(destDir, destFilename);
    
    // Check if destination already exists
    const destFile = Bun.file(destPath);
    if (await destFile.exists()) {
      // Add timestamp to avoid overwriting
      const timestamp = Date.now();
      const ext = destFilename.includes(".") ? destFilename.split(".").pop() : "";
      const base = destFilename.replace(`.${ext}`, "");
      const newFilename = ext ? `${base}-${timestamp}.${ext}` : `${base}-${timestamp}`;
      const newDestPath = join(destDir, newFilename);
      
      await Bun.write(newDestPath, sourceFile);
      return { success: true, savedPath: newDestPath };
    }

    await Bun.write(destPath, sourceFile);
    return { success: true, savedPath: destPath };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get file icon based on mime type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📽";
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed")) return "📦";
  if (mimeType.includes("text")) return "📃";
  return "📎";
}

/**
 * Open the downloads folder in the file manager
 */
export async function openFolder(folderPath: string): Promise<{ success: boolean; error?: string }> {
  return openFile(folderPath);
}