import {
  CHUNK_SIZE,
  MAX_MEMORY_FILE,
  metrics,
  validateOffer,
  waitForBuffer,
} from "./transfer.js";

// Owns file protocol state independently of React and WebRTC negotiation.
export function createFileProtocol({
  connections,
  control,
  config,
  setTransfers,
  updateTransfer,
}) {
  const memoryUsed = { current: 0 };
  const urls = { current: new Set() };
  const knownIDs = new Set();
  const failTransfers = (p, reason) => {
    if (p.outgoing) {
      p.outgoing.failure = reason;
      p.outgoing.controller.abort();
      p.outgoing.reject?.(new Error(reason));
      updateTransfer(p.outgoing.id, { status: "failed", error: reason });
      p.outgoing = null;
    }
    if (p.incoming) {
      p.incoming.writer?.abort().catch(() => {});
      if (p.incoming.reserved) memoryUsed.current -= p.incoming.size;
      updateTransfer(p.incoming.id, { status: "failed", error: reason });
      p.incoming = null;
    }
  };

  const receiveChunk = async (p, data) => {
    if (typeof data !== "string") {
      const incoming = p.incoming;
      if (!incoming) return;
      if (incoming.status !== "receiving")
        throw new Error("Unexpected file chunk");
      if (
        !(data instanceof ArrayBuffer) ||
        data.byteLength > CHUNK_SIZE ||
        incoming.bytes + data.byteLength > incoming.size
      )
        throw new Error("Invalid file chunk");
      if (incoming.writer) {
        try {
          await incoming.writer.write(data);
        } catch (error) {
          if (p.incoming !== incoming) return;
          throw error;
        }
      } else incoming.parts.push(data);
      if (p.incoming !== incoming) return;
      incoming.bytes += data.byteLength;
      updateTransfer(
        incoming.id,
        metrics(incoming.bytes, incoming.size, incoming.started),
      );
      // Acknowledgements bound the receiver queue even on slow disks.
      await control(p, {
        type: "file-ack",
        id: incoming.id,
        bytes: incoming.bytes,
      });
      return;
    }
  };
  const handleControl = async (p, msg) => {
    switch (msg.type) {
      case "file-offer": {
        if (!validateOffer(msg) || p.incoming || knownIDs.has(msg.id)) {
          await control(p, { type: "file-reject", id: msg.id });
          break;
        }
        const incoming = {
          ...msg,
          peer: p.id,
          bytes: 0,
          parts: [],
          status: "pending",
          direction: "incoming",
        };
        p.incoming = incoming;
        knownIDs.add(msg.id);
        setTransfers((all) => [
          ...all,
          {
            id: incoming.id,
            name: incoming.name,
            size: incoming.size,
            peer: p.id,
            bytes: 0,
            progress: 0,
            status: "pending",
            direction: "incoming",
          },
        ]);
        config.current.notify(
          `${p.name || "A peer"} wants to send ${msg.name}`,
        );
        break;
      }
      case "file-accept":
        if (p.outgoing?.id === msg.id) p.outgoing.accept?.();
        break;
      case "file-ack":
        if (
          p.outgoing?.id === msg.id &&
          Number.isSafeInteger(msg.bytes) &&
          msg.bytes >= p.outgoing.acked &&
          msg.bytes <= p.outgoing.sent
        ) {
          p.outgoing.acked = msg.bytes;
          if (p.outgoing.started)
            updateTransfer(
              msg.id,
              metrics(msg.bytes, p.outgoing.size, p.outgoing.started),
            );
          p.outgoing.wake?.();
        }
        break;
      case "file-reject":
      case "file-cancel": {
        if (p.outgoing?.id === msg.id) {
          p.outgoing.controller.abort();
          p.outgoing.reject?.(new Error("Transfer cancelled by peer"));
          updateTransfer(msg.id, { status: "cancelled" });
        }
        if (p.incoming?.id === msg.id) {
          const incoming = p.incoming;
          p.incoming = null;
          if (incoming.reserved) memoryUsed.current -= incoming.size;
          await incoming.writer?.abort();
          updateTransfer(msg.id, { status: "cancelled" });
        }
        break;
      }
      case "file-end": {
        const incoming = p.incoming;
        if (!incoming) return;
        if (incoming.id !== msg.id || incoming.bytes !== incoming.size)
          throw new Error("Incomplete file");
        let url;
        if (incoming.writer) await incoming.writer.close();
        else {
          url = URL.createObjectURL(
            new Blob(incoming.parts, { type: "application/octet-stream" }),
          );
          urls.current.add(url);
        }
        incoming.parts = [];
        p.incoming = null;
        updateTransfer(msg.id, {
          status: "complete",
          progress: 100,
          url,
          saved: !!incoming.writer,
        });
        await control(p, { type: "file-complete", id: msg.id });
        config.current.notify("File received securely");
        break;
      }
      case "file-complete":
        if (p.outgoing?.id === msg.id) p.outgoing.complete?.();
        break;

      default:
        break;
    }
  };
  const acceptFile = async (id, toDisk = false) => {
    const p = [...connections.current.values()].find(
      (p) => p.incoming?.id === id,
    );
    if (!p) return;
    const incoming = p.incoming;
    if (incoming.status !== "pending" || incoming.accepting) return;
    incoming.accepting = true;
    try {
      if (toDisk) {
        const handle = await window.showSaveFilePicker({
          suggestedName: incoming.name,
        });
        incoming.writer = await handle.createWritable();
      } else {
        if (
          incoming.size > MAX_MEMORY_FILE ||
          memoryUsed.current + incoming.size > MAX_MEMORY_FILE
        )
          throw new Error(
            "The 256 MB session memory budget is full. Choose Save to disk or start a new session.",
          );
        memoryUsed.current += incoming.size;
        incoming.reserved = true;
      }
      if (p.incoming !== incoming) {
        await incoming.writer?.abort();
        return;
      }
      incoming.started = performance.now();
      incoming.status = "receiving";
      updateTransfer(id, { status: "receiving" });
      await control(p, { type: "file-accept", id });
    } catch (error) {
      if (incoming.reserved) {
        memoryUsed.current -= incoming.size;
        incoming.reserved = false;
      }
      if (incoming.status === "receiving") {
        p.incoming = null;
        await incoming.writer?.abort().catch(() => {});
        updateTransfer(id, { status: "failed", error: error.message });
      }
      if (error.name !== "AbortError") config.current.notify(error.message);
    } finally {
      incoming.accepting = false;
    }
  };
  const cancelTransfer = async (id) => {
    const p = [...connections.current.values()].find(
      (p) => p.incoming?.id === id || p.outgoing?.id === id,
    );
    if (!p) return;
    if (p.outgoing?.id === id) {
      p.outgoing.controller.abort();
      p.outgoing.reject?.(new Error("Transfer cancelled"));
    }
    if (p.incoming?.id === id) {
      const incoming = p.incoming;
      p.incoming = null;
      if (incoming.reserved) memoryUsed.current -= incoming.size;
      await incoming.writer?.abort().catch(() => {});
    }
    updateTransfer(id, { status: "cancelled" });
    await control(p, { type: "file-cancel", id }).catch(() => {});
  };
  const sendFile = async (file, targetID) => {
    const p = connections.current.get(targetID);
    if (!p || p.channel?.readyState !== "open")
      throw new Error("Choose a connected peer");
    if (p.outgoing)
      throw new Error("Wait for the current transfer to this peer");
    const id = crypto.randomUUID(),
      controller = new AbortController();
    const outgoing = { id, controller, acked: 0, sent: 0, size: file.size };
    p.outgoing = outgoing;
    knownIDs.add(id);
    setTransfers((all) => [
      ...all,
      {
        id,
        name: file.name,
        size: file.size,
        peer: targetID,
        direction: "outgoing",
        status: "pending",
        bytes: 0,
        progress: 0,
      },
    ]);
    const wait = (field, timeout = 60000) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Peer response timed out"));
        }, timeout);
        const abort = () => {
          cleanup();
          reject(new DOMException("Cancelled", "AbortError"));
        };
        const cleanup = () => {
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", abort);
          outgoing[field] = null;
          outgoing.reject = null;
        };
        outgoing[field] = () => {
          cleanup();
          resolve();
        };
        outgoing.reject = (error) => {
          cleanup();
          reject(error);
        };
        controller.signal.addEventListener("abort", abort, { once: true });
        if (controller.signal.aborted) abort();
      });
    try {
      await Promise.all([
        wait("accept"),
        control(p, {
          type: "file-offer",
          id,
          name: file.name,
          size: file.size,
        }),
      ]);
      const started = performance.now();
      outgoing.started = started;
      updateTransfer(id, { status: "sending" });
      for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
        await waitForBuffer(p.channel, controller.signal);
        const data = await file
          .slice(offset, offset + CHUNK_SIZE)
          .arrayBuffer();
        if (controller.signal.aborted)
          throw new DOMException("Cancelled", "AbortError");
        outgoing.sent += data.byteLength;
        p.channel.send(data);
        while (outgoing.sent - outgoing.acked >= 256 * 1024)
          await wait("wake", 30000);
      }
      while (outgoing.acked < outgoing.sent) await wait("wake", 30000);
      await Promise.all([
        wait("complete"),
        control(p, { type: "file-end", id }),
      ]);
      updateTransfer(id, { status: "complete", progress: 100 });
      config.current.notify("File delivered securely");
    } catch (error) {
      outgoing.reject?.(error);
      updateTransfer(id, {
        status: outgoing.failure
          ? "failed"
          : controller.signal.aborted
            ? "cancelled"
            : "failed",
        error: outgoing.failure || error.message,
      });
      await control(p, { type: "file-cancel", id }).catch(() => {});
      if (!controller.signal.aborted) config.current.notify(error.message);
    } finally {
      p.outgoing = null;
    }
  };

  return {
    failTransfers,
    receiveChunk,
    handleControl,
    acceptFile,
    cancelTransfer,
    sendFile,
    dispose() {
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    },
  };
}
