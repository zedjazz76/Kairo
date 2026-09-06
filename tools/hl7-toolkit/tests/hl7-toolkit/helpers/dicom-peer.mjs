// Controlled loopback-only DICOM Verification peer for service/browser tests.
import net from 'node:net';
import assert from 'node:assert/strict';
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const item = (type, body) => Buffer.concat([Buffer.from([type, 0]), u16(body.length), body]);
const uid = text => Buffer.from(text, 'ascii');
const app = item(0x10, uid('1.2.840.10008.3.1.1.1'));
const pdu = (type, body) => Buffer.concat([Buffer.from([type, 0]), u32(body.length), body]);
const commandElement = (tag, value) => { const h = Buffer.alloc(8); h.writeUInt16LE(tag, 2); h.writeUInt32LE(value.length, 4); return Buffer.concat([h, value]); };
const us = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
function command(mode) {
  const body = Buffer.concat([
    commandElement(2, Buffer.from('1.2.840.10008.1.1\0')),
    commandElement(0x100, us(mode === 'wrong-command' ? 0x8020 : 0x8030)),
    commandElement(0x120, us(mode === 'wrong-id' ? 2 : 1)),
    commandElement(0x800, us(0x101)), commandElement(0x900, us(mode === 'echo-failed' ? 0x0122 : 0)),
  ]);
  const length = Buffer.alloc(4); length.writeUInt32LE(body.length);
  return Buffer.concat([commandElement(0, length), body]);
}
export async function startDicomPeer(mode = 'success') {
  const sockets = new Set(); const observations = { associations: 0, echoes: 0, released: false, errors: [] };
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket));
    let buffer = Buffer.alloc(0);
    socket.on('data', data => {
      buffer = Buffer.concat([buffer, data]);
      try {
        while (buffer.length >= 6 && buffer.length >= 6 + buffer.readUInt32BE(2)) {
          const type = buffer[0], body = buffer.subarray(6, 6 + buffer.readUInt32BE(2)); buffer = buffer.subarray(6 + body.length);
          if (type === 1) {
            observations.associations++;
            assert.equal(body.readUInt16BE(0), 1);
            assert.equal(body.subarray(4, 20).toString().trim(), 'TEST_SCP');
            assert.equal(body.subarray(20, 36).toString().trim(), 'KAIRO');
            assert.ok(body.includes(item(0x30, uid('1.2.840.10008.1.1'))));
            assert.ok(body.includes(item(0x40, uid('1.2.840.10008.1.2'))));
            if (mode === 'association-timeout') continue;
            if (mode === 'reject') { socket.write(pdu(3, Buffer.from([0, 1, 1, 7]))); continue; }
            if (mode === 'abort') { socket.write(pdu(7, Buffer.from([0, 0, 2, 0]))); continue; }
            if (mode === 'oversized') { socket.write(Buffer.from([2, 0, 0, 16, 0, 1])); continue; }
            if (mode === 'malformed') { socket.write(pdu(2, Buffer.from([0, 1]))); continue; }
            const context = item(0x21, Buffer.concat([Buffer.from([1, 0, mode === 'context-rejected' ? 3 : 0, 0]), item(0x40, uid(mode === 'wrong-syntax' ? '1.2.840.10008.1.2.1' : '1.2.840.10008.1.2'))]));
            const user = item(0x50, Buffer.concat([item(0x51, u32(16384)), item(0x52, uid('2.25.123456789'))]));
            socket.write(pdu(2, Buffer.concat([body.subarray(0, 72), app, context, user])));
          } else if (type === 4) {
            observations.echoes++;
            assert.equal(body.readUInt32BE(0), body.length - 4); assert.equal(body[4], 1); assert.equal(body[5], 3);
            const cmd = body.subarray(6); const fields = new Map();
            for (let p = 0; p < cmd.length;) { assert.equal(cmd.readUInt16LE(p), 0); const n = cmd.readUInt32LE(p + 4); fields.set(cmd.readUInt16LE(p + 2), cmd.subarray(p + 8, p + 8 + n)); p += 8 + n; }
            assert.equal(fields.get(0x100).readUInt16LE(), 0x30); assert.equal(fields.get(0x110).readUInt16LE(), 1); assert.equal(fields.get(0x800).readUInt16LE(), 0x101);
            assert.equal(fields.get(2).toString().replace(/\0$/, ''), '1.2.840.10008.1.1');
            if (mode === 'echo-timeout') continue;
            if (mode === 'incomplete') { socket.end(Buffer.from([4, 0, 0])); continue; }
            const response = command(mode);
            const fragments = mode === 'fragmented' ? [response.subarray(0, 17), response.subarray(17)] : [response];
            fragments.forEach((fragment, i) => {
              const pdv = Buffer.concat([Buffer.from([mode === 'wrong-context' ? 3 : 1, i === fragments.length - 1 ? 3 : 1]), fragment]);
              const packet = pdu(4, Buffer.concat([u32(pdv.length), pdv]));
              // Separate writes exercise arbitrary TCP segmentation as well as multiple command PDVs.
              socket.write(packet.subarray(0, 3)); socket.write(packet.subarray(3));
            });
          } else if (type === 5) { observations.released = true; socket.end(pdu(6, Buffer.alloc(4))); }
          else assert.fail('Unexpected client PDU');
        }
      } catch (error) { observations.errors.push(error.message); socket.destroy(); }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, observations, async close() { for (const s of sockets) s.destroy(); await new Promise(resolve => server.close(resolve)); } };
}
