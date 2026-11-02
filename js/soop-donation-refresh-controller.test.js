'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createFakeTimers() {
  let nextId = 1;
  const pending = new Map();
  return {
    pending,
    setTimeout(callback, delayMs) {
      const id = nextId++;
      pending.set(id, { callback, delayMs });
      return id;
    },
    clearTimeout(id) { pending.delete(id); },
    async fireNext() {
      const entry = pending.entries().next().value;
      if (!entry) return false;
      const [id, timer] = entry;
      pending.delete(id);
      await timer.callback();
      return true;
    },
  };
}

function loadController() {
  const window = {};
  const source = fs.readFileSync(path.join(__dirname, 'soop-donation-refresh-controller.js'), 'utf8');
  vm.runInNewContext(source, { window, Math, Number, Promise });
  return window.createOnyuSoopTokenRefreshController;
}

test('refresh uses one-shot timers and schedules the next refresh from expires_in', async () => {
  const createController = loadController();
  const timers = createFakeTimers();
  const authTokens = [];
  let refreshCalls = 0;
  const controller = createController({
    refresh: async () => { refreshCalls += 1; return { ok: true, accessToken: 'new-access', expiresInSeconds: 600 }; },
    applyAccessToken: (token) => authTokens.push(token),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });

  assert.equal(controller.start(120), true);
  assert.equal([...timers.pending.values()][0].delayMs, 60_000);
  await timers.fireNext();
  assert.equal(refreshCalls, 1);
  assert.deepEqual(authTokens, ['new-access']);
  assert.equal([...timers.pending.values()][0].delayMs, 540_000);
  controller.stop();
  assert.equal(timers.pending.size, 0);
});

test('confirmed revocation disconnects Chat SDK and permanently blocks reconnect', async () => {
  const createController = loadController();
  const timers = createFakeTimers();
  let disconnectCalls = 0;
  const states = [];
  const controller = createController({
    refresh: async () => ({ ok: false, revoked: true }),
    chatSdk: { disconnect: () => { disconnectCalls += 1; } },
    onState: (state) => states.push(state.state),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });

  controller.start(120);
  await timers.fireNext();
  assert.equal(disconnectCalls, 1);
  assert.equal(controller.isReconnectBlocked(), true);
  assert.equal(controller.isRunning(), false);
  assert.equal(timers.pending.size, 0);
  assert.deepEqual(states, ['refreshing', 'revoked']);
  assert.equal(controller.start(120), false, '확인된 철회는 같은 controller에서 다시 시작할 수 없어야 한다');
});

test('transient failure retries with backoff; stop cancels the pending retry', async () => {
  const createController = loadController();
  const timers = createFakeTimers();
  const controller = createController({
    refresh: async () => { throw new Error('temporary network failure'); },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });

  controller.start(120);
  await timers.fireNext();
  assert.equal([...timers.pending.values()][0].delayMs, 15_000);
  controller.stop();
  assert.equal(timers.pending.size, 0);
  assert.equal(controller.isReconnectBlocked(), false);
});

test('unclassified authorization errors stop refresh attempts without treating them as confirmed revocation', async () => {
  const createController = loadController();
  const timers = createFakeTimers();
  let disconnectCalls = 0;
  const states = [];
  const controller = createController({
    refresh: async () => ({ ok: false, retryable: false, revoked: false }),
    chatSdk: { disconnect: () => { disconnectCalls += 1; } },
    onState: (state) => states.push(state.state),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });

  controller.start(120);
  await timers.fireNext();
  assert.equal(disconnectCalls, 1);
  assert.equal(controller.isReconnectBlocked(), true);
  assert.equal(controller.isRunning(), false);
  assert.equal(timers.pending.size, 0);
  assert.equal(controller.start(120), false);
  assert.deepEqual(states, ['refreshing', 'authorization-error']);
});

test('refresh race that is no longer due re-schedules from the current expiry', async () => {
  const createController = loadController();
  const timers = createFakeTimers();
  const controller = createController({
    refresh: async () => ({ ok: true, refreshNeeded: false, expiresInSeconds: 300 }),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });

  controller.start(120);
  await timers.fireNext();
  assert.equal([...timers.pending.values()][0].delayMs, 240_000);
  controller.stop();
});

test('stopping an active controller disconnects Chat SDK and cancels its timer', () => {
  const createController = loadController();
  const timers = createFakeTimers();
  let disconnectCalls = 0;
  const controller = createController({
    refresh: async () => ({ ok: true, accessToken: 'unused', expiresInSeconds: 600 }),
    applyAccessToken: () => {},
    chatSdk: { disconnect: () => { disconnectCalls += 1; } },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  controller.start(120);
  controller.stop();
  assert.equal(disconnectCalls, 1);
  assert.equal(timers.pending.size, 0);
});
