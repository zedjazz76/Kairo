// Controlled loopback-only DICOM MWL peer for service integration tests.
import assert from 'node:assert/strict';
import net from 'node:net';

const MWL = '1.2.840.10008.5.1.4.31';
const IMPLICIT = '1.2.840.10008.1.2';
const APPLICATION = '1.2.840.10008.3.1.1.1';
const be16 = value => { const bytes = Buffer.alloc(2); bytes.writeUInt16BE(value); return bytes; };
const be32 = value => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; };
const le16 = value => { const bytes = Buffer.alloc(2); bytes.writeUInt16LE(value); return bytes; };
const le32 = value => { const bytes = Buffer.alloc(4); bytes.writeUInt32LE(value); return bytes; };
const item = (type, body) => Buffer.concat([Buffer.from([type, 0]), be16(body.length), body]);
const pdu = (type, body) => Buffer.concat([Buffer.from([type, 0]), be32(body.length), body]);
const commandElement = (element, value) => Buffer.concat([Buffer.from([0, 0]), le16(element), le32(value.length), value]);
const datasetElement = (group, element, value) => Buffer.concat([le16(group), le16(element), le32(value.length), value]);
const textValue = (text, encoding = 'ascii') => {
  const raw = Buffer.from(text ?? '', encoding);
  return raw.length % 2 === 0 ? raw : Buffer.concat([raw, Buffer.from(' ')]);
};
const textElement = (group, element, value, encoding) => datasetElement(group, element, textValue(value, encoding));

function responseCommand(status, hasDataset) {
  const fields = Buffer.concat([
    commandElement(0x0002, Buffer.from(`${MWL}\0`, 'ascii')),
    commandElement(0x0100, le16(0x8020)),
    commandElement(0x0120, le16(1)),
    commandElement(0x0800, le16(hasDataset ? 0x0000 : 0x0101)),
    commandElement(0x0900, le16(status))
  ]);
  return Buffer.concat([commandElement(0x0000, le32(fields.length)), fields]);
}

function identifier(value) {
  const step = value.scheduledProcedureStep ?? {};
  const encoding = value.textEncoding ?? 'ascii';
  const stepBody = Buffer.concat([
    textElement(0x0040, 0x0001, step.scheduledStationAe, encoding),
    textElement(0x0040, 0x0002, step.scheduledDate, encoding),
    textElement(0x0040, 0x0003, step.scheduledTime, encoding),
    textElement(0x0008, 0x0060, step.modality, encoding),
    textElement(0x0040, 0x0011, step.scheduledLocation, encoding)
  ]);
  const sequenceItem = Buffer.concat([le16(0xfffe), le16(0xe000), le32(stepBody.length), stepBody]);
  return Buffer.concat([
    value.specificCharacterSet ? textElement(0x0008, 0x0005, value.specificCharacterSet, 'ascii') : Buffer.alloc(0),
    textElement(0x0010, 0x0010, value.patientName, encoding),
    textElement(0x0010, 0x0020, value.patientId, encoding),
    textElement(0x0008, 0x0050, value.accessionNumber, encoding),
    textElement(0x0040, 0x1001, value.requestedProcedureId, encoding),
    textElement(0x0032, 0x1060, value.requestedProcedureDescription, encoding),
    datasetElement(0x0040, 0x0100, sequenceItem)
  ]);
}

function dataPdu(command, dataset) {
  const parts = [Buffer.concat([be32(command.length + 2), Buffer.from([1, 3]), command])];
  if (dataset) parts.push(Buffer.concat([be32(dataset.length + 2), Buffer.from([1, 2]), dataset]));
  return pdu(4, Buffer.concat(parts));
}

function commandMetadata(body) {
  const pdvLength = body.readUInt32BE(0);
  assert.ok(pdvLength >= 2 && pdvLength <= body.length - 4);
  const command = body.subarray(6, 4 + pdvLength);
  const fields = new Map();
  for (let offset = 0; offset < command.length;) {
    assert.equal(command.readUInt16LE(offset), 0);
    const element = command.readUInt16LE(offset + 2);
    const length = command.readUInt32LE(offset + 4);
    offset += 8;
    fields.set(element, command.subarray(offset, offset + length));
    offset += length;
  }
  return {
    commandField: fields.get(0x0100)?.readUInt16LE(0),
    messageId: fields.get(0x0110)?.readUInt16LE(0),
    messageIdBeingRespondedTo: fields.get(0x0120)?.readUInt16LE(0)
  };
}

export async function startMwlPeer(scenario) {
  const sockets = new Set();
  const requests = { associations: 0, find: null, cancel: null };
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    let incoming = Buffer.alloc(0);
    socket.on('data', chunk => {
      incoming = Buffer.concat([incoming, chunk]);
      while (incoming.length >= 6 && incoming.length >= 6 + incoming.readUInt32BE(2)) {
        const type = incoming[0];
        const body = incoming.subarray(6, 6 + incoming.readUInt32BE(2));
        incoming = incoming.subarray(6 + body.length);
        if (type === 1) {
          requests.associations += 1;
          assert.equal(body.readUInt16BE(0), 1);
          assert.ok(body.includes(item(0x30, Buffer.from(MWL, 'ascii'))));
          assert.ok(body.includes(item(0x40, Buffer.from(IMPLICIT, 'ascii'))));
          const context = item(0x21, Buffer.concat([Buffer.from([1, 0, 0, 0]), item(0x40, Buffer.from(IMPLICIT, 'ascii'))]));
          const user = item(0x50, item(0x51, be32(16384)));
          socket.write(pdu(2, Buffer.concat([body.subarray(0, 68), item(0x10, Buffer.from(APPLICATION, 'ascii')), context, user])));
        } else if (type === 4) {
          const metadata = commandMetadata(body);
          if (metadata.commandField === 0x0020) {
            requests.find = metadata;
            const outgoing = [];
            for (const response of scenario.responses ?? []) {
              const data = response.item ? identifier(response.item) : null;
              outgoing.push(dataPdu(responseCommand(response.status, Boolean(data)), data));
            }
            if (outgoing.length) socket.write(Buffer.concat(outgoing));
          } else if (metadata.commandField === 0x0fff) {
            if (scenario.resetBeforeCancel) { socket.resetAndDestroy(); continue; }
            requests.cancel = metadata;
            if (scenario.cancelResponseStatus !== undefined) {
              socket.write(dataPdu(responseCommand(scenario.cancelResponseStatus, false), null));
            } else if (scenario.closeAfterCancel) {
              socket.end();
            }
          }
        } else if (type === 5) {
          socket.end(pdu(6, Buffer.alloc(4)));
        }
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    host: '127.0.0.1', port: server.address().port, requests,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    }
  };
}
