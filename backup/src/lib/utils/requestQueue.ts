// Limits how many avatar images load concurrently across the whole app, so
// rendering many <VoiceAvatar> at once doesn't overwhelm the (flaky, free)
// Pollinations generation endpoint. Each caller awaits its turn, then calls
// the returned release() once its request settles (load or error).
const MAX_CONCURRENT = 2;
let active = 0;
const queue: Array<() => void> = [];

function runNext() {
  if (active >= MAX_CONCURRENT) return;
  const task = queue.shift();
  if (!task) return;
  active++;
  task();
}

export function enqueueTurn(): Promise<() => void> {
  return new Promise((resolve) => {
    queue.push(() => resolve(() => { active--; runNext(); }));
    runNext();
  });
}
