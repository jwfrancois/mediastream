// Server-side rate-limit queue for LLM calls.
// The z-ai LLM API aggressively rate-limits (429) when calls come too fast.
// This module ensures only one LLM call is in-flight at a time, with a
// minimum delay between calls. The queue lives in module scope so all
// API routes share it.
//
// IMPORTANT: The server must respond within 60 seconds (ALB timeout).
// This means: queue wait + LLM call time must be < 55s. We keep the
// queue delay short (5s) and do NO server-side 429 retries — the client
// handles all retries since it has no timeout.

import ZAI from 'z-ai-web-dev-sdk';

let zaiInstance: any = null;
let lastCallTime = 0;
const MIN_DELAY_MS = 5000; // 5 seconds between LLM calls = ~12 per minute
let pendingPromise: Promise<void> = Promise.resolve();
let queueDepth = 0; // number of calls waiting in the queue

// Get or create the ZAI singleton
async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Serialize LLM calls — only one at a time, with minimum delay.
// If the queue is too deep (wait would exceed 30s), throw immediately
// so the server can return 429 to the client for client-side retry.
export async function callLLM(messages: Array<{ role: string; content: string }>, options?: any): Promise<any> {
  // Check queue depth — if too many calls are pending, bail immediately
  // to avoid exceeding the ALB's 60s timeout.
  if (queueDepth >= 2) {
    throw new Error('429: Too many requests (queue busy)');
  }

  queueDepth++;

  const myTurn = pendingPromise.then(async () => {
    queueDepth--; // we're now executing, no longer waiting

    const now = Date.now();
    const elapsed = now - lastCallTime;
    if (elapsed < MIN_DELAY_MS) {
      const wait = MIN_DELAY_MS - elapsed;
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

// NO server-side retries — return 429 to client immediately so the client
// can handle the retry (client has no ALB timeout and can wait as long
// as needed with its own 30s/60s/90s retry logic).
export async function callLLMWithRetry(
  messages: Array<{ role: string; content: string }>,
  options?: any,
  _maxRetries = 0, // ignored — kept for API compatibility
): Promise<any> {
  return callLLM(messages, options);
}
