'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGate() {
  const window = {};
  const source = fs.readFileSync(path.join(__dirname, 'soop-donation-events.js'), 'utf8');
  vm.runInNewContext(source, { window, Promise, Number, Object });
  return window.createOnyuDonationEventGate;
}

test('one active outfit picker ignores duplicate events while the server confirms and after confirmation', async () => {
  const createGate = loadGate();
  let calls = 0;
  let confirm;
  const gate = createGate(() => {
    calls += 1;
    return new Promise((resolve) => { confirm = resolve; });
  });
  const event = { count: 50, fromVod: false, userId: 'must-not-be-forwarded' };

  const first = gate.handle(event);
  const concurrentDuplicate = gate.handle(event);
  assert.equal(JSON.stringify(concurrentDuplicate), JSON.stringify({ accepted: false, reason: 'event-pending' }));
  assert.equal(calls, 1);

  confirm(true);
  assert.equal(JSON.stringify(await first), JSON.stringify({ accepted: true, count: 50 }));
  assert.equal(JSON.stringify(gate.handle(event)), JSON.stringify({ accepted: false, reason: 'session-consumed' }));
  assert.equal(calls, 1);
});

test('only a single LIVE event with at least 50 items reaches the confirmation callback', () => {
  const createGate = loadGate();
  let calls = 0;
  const gate = createGate(() => { calls += 1; return true; });
  assert.equal(JSON.stringify(gate.handle({ count: 50, fromVod: true })), JSON.stringify({ accepted: false, reason: 'not-live' }));
  assert.equal(JSON.stringify(gate.handle({ count: 49, fromVod: false })), JSON.stringify({ accepted: false, reason: 'below-threshold', count: 49 }));
  assert.equal(JSON.stringify(gate.handle({ count: 50, fromVod: false, userNickname: 'must-not-be-forwarded' })), JSON.stringify({ accepted: true, count: 50 }));
  assert.equal(calls, 1);
});
