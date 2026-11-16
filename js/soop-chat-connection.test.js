'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'soop-chat-connection.js'), 'utf8'), { window, Promise, Number, Object, String, Error });
  return window;
}

function fakeSdkClass(log) {
  return function FakeSdk(clientId, secret) {
    log.ctor = { clientId, secret };
    this.init = () => { log.init = true; };
    this.setAuth = (t) => { (log.auth = log.auth || []).push(t); };
    this.connect = async () => { log.connected = true; };
    this.disconnect = () => { log.disconnected = (log.disconnected || 0) + 1; };
    this.handleMessageReceived = (cb) => { log.emit = cb; };
    this.handleChatClosed = (cb) => { log.closed = cb; };
    this.handleError = (cb) => { log.error = cb; };
  };
}

test('Client Secret 없이 연결하고 BALLOON_GIFTED에서 판정 값만 넘긴다', async () => {
  const w = load();
  const log = {};
  const got = [];
  const conn = w.createOnyuSoopChatConnection({ ChatSDK: fakeSdkClass(log), clientId: 'cid', onDonation: (s) => got.push(s) });
  await conn.connect('ACCESS');
  assert.equal(log.ctor.clientId, 'cid');
  assert.equal(log.ctor.secret, undefined);
  assert.deepEqual(log.auth, ['ACCESS']);
  assert.equal(log.connected, true);
  log.emit('BALLOON_GIFTED', { count: 50, fromVod: false, relaysBroad: false, userId: 'u', userNickname: 'n', imageUrl: 'x' });
  log.emit('STICKER_GIFTED', { count: 100 });
  assert.equal(got.length, 1);
  assert.deepEqual(Object.keys(got[0]).sort(), ['count', 'fromVod', 'relaysBroad']);
  conn.applyAccessToken('NEW');
  assert.deepEqual(log.auth, ['ACCESS', 'NEW']);
  conn.sdkForRefresh.disconnect();
  assert.equal(log.disconnected, 1);
});

test('우리가 끊은 연결은 closed 상태를 알리지 않는다', async () => {
  const w = load();
  const log = {};
  const states = [];
  const conn = w.createOnyuSoopChatConnection({ ChatSDK: fakeSdkClass(log), clientId: 'cid', onState: (s) => states.push(s.state) });
  await conn.connect('A');
  log.closed();
  conn.disconnect();
  log.closed();
  assert.deepEqual(states, ['connected', 'closed']);
});
