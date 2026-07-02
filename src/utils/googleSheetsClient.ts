import {
  GOOGLE_SHEETS_ENABLED,
  GOOGLE_SHEETS_SPREADSHEET_ID,
  GOOGLE_SHEETS_WEB_APP_URL
} from './googleSheetsConfig';

export type SheetWriteMode = 'append' | 'upsert' | 'update';

export interface SheetWrite {
  tab: string;
  primaryKey: string;
  mode: SheetWriteMode;
  row: Record<string, unknown>;
}

export interface SheetAction {
  action: string;
  writes: SheetWrite[];
  metadata?: Record<string, unknown>;
}

interface QueuedSheetAction extends SheetAction {
  queue_id: string;
  queued_at: string;
  attempts: number;
}

const QUEUE_KEY = 'amavita_google_sheets_queue';
let isFlushing = false;
let warnedMissingConfig = false;

const readQueue = (): QueuedSheetAction[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as QueuedSheetAction[];
  } catch {
    return [];
  }
};

const writeQueue = (queue: QueuedSheetAction[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, 500)));
};

export function googleSheetsConfigured(): boolean {
  return Boolean(GOOGLE_SHEETS_ENABLED && GOOGLE_SHEETS_WEB_APP_URL);
}

export function enqueueGoogleSheetsAction(action: SheetAction): void {
  if (!GOOGLE_SHEETS_ENABLED) return;

  if (!GOOGLE_SHEETS_WEB_APP_URL) {
    if (!warnedMissingConfig) {
      console.warn('Google Sheets sync is enabled but VITE_GOOGLE_SHEETS_WEB_APP_URL is not configured.');
      warnedMissingConfig = true;
    }
    return;
  }

  const queue = readQueue();
  queue.push({
    ...action,
    queue_id: `gsq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queued_at: new Date().toISOString(),
    attempts: 0
  });
  writeQueue(queue);
  void flushGoogleSheetsQueue();
}

export async function flushGoogleSheetsQueue(): Promise<void> {
  if (!googleSheetsConfigured() || isFlushing) return;

  isFlushing = true;
  try {
    const queue = readQueue();
    const remaining: QueuedSheetAction[] = [];

    for (const item of queue) {
      try {
        const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
          method: 'POST',
          body: JSON.stringify({
            spreadsheet_id: GOOGLE_SHEETS_SPREADSHEET_ID || undefined,
            ...item
          })
        });

        if (!response.ok) throw new Error(`Google Sheets write failed: ${response.status}`);
        const payload = await response.json().catch(() => ({ ok: true }));
        if (payload?.ok === false) throw new Error(payload.error || 'Google Sheets write failed.');
      } catch (error) {
        const attempts = item.attempts + 1;
        console.warn('Google Sheets sync queued for retry:', error);
        remaining.push({ ...item, attempts });
      }
    }

    writeQueue(remaining);
  } finally {
    isFlushing = false;
  }
}

export function getPendingGoogleSheetsWrites(): QueuedSheetAction[] {
  return readQueue();
}
