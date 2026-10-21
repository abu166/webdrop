import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSecret,
  importRoomKey,
  encryptPayload,
  decryptPayload,
  signalingToken,
} from "../src/utils/crypto.js";
import { waitForBuffer, validateOffer } from "../src/utils/transfer.js";
test("room encryption round trips and rejects a different invite key", async () => {
  const secret = createSecret(),
    key = await importRoomKey(secret);
  const wire = await encryptPayload(key, { type: "chat", text: "hello 🌍" });
  assert.ok(!wire.includes("hello"));
  assert.deepEqual(await decryptPayload(key, wire), {
    type: "chat",
    text: "hello 🌍",
  });
  const wrong = await importRoomKey(createSecret());
  await assert.rejects(() => decryptPayload(wrong, wire));
  assert.equal((await signalingToken(secret)).length, 64);
});
test("tampered encrypted payloads fail authentication", async () => {
  const key = await importRoomKey(createSecret());
  const wire = JSON.parse(await encryptPayload(key, { text: "secret" }));
  wire.data = (wire.data[0] === "A" ? "B" : "A") + wire.data.slice(1);
  await assert.rejects(() => decryptPayload(key, JSON.stringify(wire)));
});
class Channel extends EventTarget {
  readyState = "open";
  bufferedAmount = 128 * 1024;
}
test("backpressure waits for a low buffer and removes listeners", async () => {
  const channel = new Channel(),
    abort = new AbortController();
  let done = false;
  const wait = waitForBuffer(channel, abort.signal).then(() => (done = true));
  await Promise.resolve();
  assert.equal(done, false);
  channel.bufferedAmount = 16000;
  channel.dispatchEvent(new Event("bufferedamountlow"));
  await wait;
  assert.equal(done, true);
});
test("backpressure rejects cancellation and closed channels", async () => {
  const channel = new Channel(),
    abort = new AbortController();
  const wait = waitForBuffer(channel, abort.signal);
  abort.abort();
  await assert.rejects(wait, { name: "AbortError" });
  channel.readyState = "closed";
  await assert.rejects(waitForBuffer(channel, new AbortController().signal));
});
test("metadata cannot allocate invalid or unbounded file sizes", () => {
  assert.equal(validateOffer({ id: "a", name: "a.txt", size: -1 }), false);
  assert.equal(
    validateOffer({ id: "a", name: "a.txt", size: Infinity }),
    false,
  );
  assert.equal(validateOffer({ id: "a", name: "a.txt", size: 2 ** 32 }), true);
});

test("aggregate file memory is reserved across peers and released on cancellation", async () => {
  const { createFileProtocol } = await import("../src/utils/fileProtocol.js");
  const first = { id: "peer-first" },
    second = { id: "peer-second" };
  const notifications = [],
    sent = [];
  const protocol = createFileProtocol({
    connections: {
      current: new Map([
        [first.id, first],
        [second.id, second],
      ]),
    },
    config: { current: { notify: (text) => notifications.push(text) } },
    control: async (peer, msg) => {
      sent.push({ ...msg, peer: peer.id });
    },
    setTransfers: () => {},
    updateTransfer: () => {},
  });
  await protocol.handleControl(first, {
    type: "file-offer",
    id: "file-first",
    name: "large.bin",
    size: 200 * 1024 * 1024,
  });
  await protocol.handleControl(second, {
    type: "file-offer",
    id: "file-second",
    name: "another.bin",
    size: 100 * 1024 * 1024,
  });
  await protocol.acceptFile("file-first");
  await protocol.acceptFile("file-second");
  assert.equal(first.incoming.status, "receiving");
  assert.equal(second.incoming.status, "pending");
  assert.ok(notifications.some((text) => text.includes("memory budget")));
  await protocol.cancelTransfer("file-first");
  await protocol.acceptFile("file-second");
  assert.equal(second.incoming.status, "receiving");
  await assert.rejects(
    protocol.receiveChunk(second, new ArrayBuffer(16385)),
    /Invalid file chunk/,
  );
  assert.equal(sent.filter((msg) => msg.type === "file-accept").length, 2);
  protocol.failTransfers(second, "Disconnected");
  assert.equal(second.incoming, null);
  protocol.dispose();
});
