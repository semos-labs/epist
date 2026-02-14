import { homedir } from "os";
import { join } from "path";
import { mkdir, readdir, unlink } from "fs/promises";

const DRAFTS_DIR = join(homedir(), ".config", "epist", "drafts");

export interface DraftData {
  id: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  content: string;
  attachments: string[]; // file paths
  replyToEmailId?: string;
  mode?: "reply" | "replyAll" | "forward";
  savedAt: number; // epoch ms
}

async function ensureDir() {
  await mkdir(DRAFTS_DIR, { recursive: true });
}

function draftPath(id: string) {
  return join(DRAFTS_DIR, `${id}.json`);
}

export async function saveDraft(draft: DraftData): Promise<void> {
  await ensureDir();
  await Bun.write(draftPath(draft.id), JSON.stringify(draft, null, 2));
}

export async function loadDraft(id: string): Promise<DraftData | null> {
  try {
    const file = Bun.file(draftPath(id));
    if (await file.exists()) {
      return JSON.parse(await file.text()) as DraftData;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function deleteDraft(id: string): Promise<void> {
  try {
    await unlink(draftPath(id));
  } catch {
    // ignore if not found
  }
}

export async function listDrafts(): Promise<DraftData[]> {
  await ensureDir();
  const files = await readdir(DRAFTS_DIR);
  const drafts: DraftData[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = JSON.parse(await Bun.file(join(DRAFTS_DIR, file)).text()) as DraftData;
      drafts.push(data);
    } catch {
      // skip corrupt files
    }
  }
  return drafts.sort((a, b) => b.savedAt - a.savedAt);
}
