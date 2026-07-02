// Server-side rate-limit queue for LLM calls.
// The z-ai LLM API aggressively rate-limits (429) when calls come too fast.
// This module ensures only one LLM call is in-flight at a time, with a
// minimum delay between calls. The queue lives in module scope so all
// API routes share it.

import ZAI from 'z-ai-web-dev-sdk';

let zaiInstance: any = null;
let lastCallTime = 0;
const MIN_DELAY_MS = 12000; // 12 seconds between LLM calls = ~5 per minute
let pendingPromise: Promise<void> = Promise.resolve();

// Get or create the ZAI singleton
async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Serialize LLM calls — only one at a time, with minimum delay
export async function callLLM(messages: Array<{ role: string; content: string }>, options?: any): Promise<any> {
  // Chain onto any pending call to ensure serialization
  const myTurn = pendingPromise.then(async () => {
    const now = Date.now();
    const elapsed = now - lastCallTime;
    if (elapsed < MIN_DELAY_MS) {
      const wait = MIN_DELAY_MS - elapsed;
      console.log(`[LLM Queue] Waiting ${wait}ms before next call...`);
      await new Promise(r => setTimeout(r, wait));
    }

    const zai = await getZai();
    lastCallTime = Date.now();
    return zai.chat.completions.create({
      messages: messages as any,
      thinking: { type: 'disabled' },
      ...options,
    });
  });

  // Update pendingPromise so the next call chains after this one
  pendingPromise = myTurn.then(() => undefined, () => undefined);

  return myTurn;
}

// Retry wrapper — if the LLM returns 429, wait and retry up to 3 times
// (server-side, since the queue already serializes)
export async function callLLMWithRetry(
  messages: Array<{ role: string; content: string }>,
  options?: any,
  maxRetries = 3,
): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callLLM(messages, options);
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('429') || msg.includes('Too many requests')) {
        if (attempt < maxRetries) {
          const waitMs = 20000 * (attempt + 1); // 20s, 40s, 60s
          console.warn(`[LLM Queue] Rate limited, waiting ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
      }
      throw e;
    }
  }
  throw new Error('LLM call failed after all retries');
}
