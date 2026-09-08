// Controlled loopback-only DICOM Study Root FIND peer. Synthetic values only.
import assert from 'node:assert/strict';
import net from 'node:net';

const STUDY_ROOT = '1.2.840.10008.5.1.4.1.2.2.1';
const IMPLICIT = '1.2.840.10008.1.2';
const EXPLICIT = '1.2.840.10008.1.2.1';
const APPLICATION = '1.2.840.10008.3.1.1.1';
const KAIRO_IMPLEMENTATION = '2.25.25815942481606045106159218101014368293';
const be16 = value => { const bytes = Buffer.alloc(2); bytes.writeUInt16BE(value); return bytes; };
const be32 = value => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; };
const le16 = value => { const bytes = Buffer.alloc(2); bytes.writeUInt16LE(value); return bytes; };
const le32 = value => { const bytes = Buffer.alloc(4); bytes.writeUInt32LE(value); return bytes; };
const itemPart = (type, body) => Buffer.concat([Buffer.from([type, 0]), be16(body.length), body]);
const pdu = (type, body) => Buffer.concat([Buffer.from([type, 0]), be32(body.length), body]);
const commandElement = (element, value) => Buffer.concat([Buffer.from([0, 0]), le16(element), le32(value.length), value]);
const padded = (value, encoding = 'ascii') => { const bytes = Buffer.from(value ?? '', encoding); return bytes.length % 2 ? Buffer.concat([bytes, Buffer.from(' ')]) : bytes; };
const element = (group, tag, value, encoding) => { const bytes = padded(value, encoding); return Buffer.concat([le16(group), le16(tag), le32(bytes.length), bytes]); };
const explicitElement = (group, tag, vr, value, encoding) => { const bytes = padded(value, encoding); return Buffer.concat([le16(group), le16(tag), Buffer.from(vr), le16(bytes.length), bytes]); };

function responseCommand(status, hasDataset, datasetType) {
  const fields = Buffer.concat([commandElement(0x0002, Buffer.from(`${STUDY_ROOT}\0`)), commandElement(0x0100, le16(0x8020)), commandElement(0x0120, le16(1)), commandElement(0x0800, le16(hasDataset ? (datasetType ?? 0) : 0x0101)), commandElement(0x0900, le16(status))]);
  return Buffer.concat([commandElement(0, le32(fields.length)), fields]);
}

function identifier(value, syntax) {
  const encoding = value.textEncoding ?? 'ascii';
  const make=(group,tag,vr,text,textEncoding)=>syntax===EXPLICIT?explicitElement(group,tag,vr,text,textEncoding):element(group,tag,text,textEncoding);
  const entries = value.specificCharacterSet ? [make(0x0008, 0x0005, 'CS', value.specificCharacterSet, 'ascii')] : [];
  for (const [group, tag, vr, name, textEncoding = encoding] of [
    [0x0010,0x0010,'PN','patientName'], [0x0010,0x0020,'LO','patientId'], [0x0008,0x0050,'SH','accessionNumber'],
    [0x0008,0x0020,'DA','studyDate','ascii'], [0x0008,0x0030,'TM','studyTime','ascii'], [0x0008,0x1030,'LO','studyDescription'],
    [0x0008,0x0061,'CS','modalitiesInStudy','ascii'], [0x0020,0x000d,'UI','studyInstanceUid','ascii'],
    [0x0020,0x1206,'IS','numberOfStudyRelatedSeries','ascii'], [0x0020,0x1208,'IS','numberOfStudyRelatedInstances','ascii'], [0x0008,0x0090,'PN','referringPhysicianName']
  ]) entries.push(make(group, tag, vr, value[name], textEncoding));
  return Buffer.concat(entries);
}

function dataPdu(command, dataset) {
  const parts = [Buffer.concat([be32(command.length + 2), Buffer.from([1, 3]), command])];
  if (dataset) parts.push(Buffer.concat([be32(dataset.length + 2), Buffer.from([1, 2]), dataset]));
  return pdu(4, Buffer.concat(parts));
}
function separateDataPdus(command,dataset) {
  return Buffer.concat([
    pdu(4,Buffer.concat([be32(command.length+2),Buffer.from([1,3]),command])),
    pdu(4,Buffer.concat([be32(dataset.length+2),Buffer.from([1,2]),dataset]))
  ]);
}
function fragmentedPdus(command,dataset){const split=value=>[value.subarray(0,Math.max(1,Math.floor(value.length/2))),value.subarray(Math.max(1,Math.floor(value.length/2)))];const output=[];const commandParts=split(command);output.push(pdu(4,Buffer.concat([be32(commandParts[0].length+2),Buffer.from([1,1]),commandParts[0]])));output.push(pdu(4,Buffer.concat([be32(commandParts[1].length+2),Buffer.from([1,3]),commandParts[1]])));if(dataset){const dataParts=split(dataset);output.push(pdu(4,Buffer.concat([be32(dataParts[0].length+2),Buffer.from([1,0]),dataParts[0]])));output.push(pdu(4,Buffer.concat([be32(dataParts[1].length+2),Buffer.from([1,2]),dataParts[1]])));}return Buffer.concat(output);}

function commandMetadata(body) {
  const length = body.readUInt32BE(0); const command = body.subarray(6, 4 + length); const fields = new Map();
  for (let offset = 0; offset < command.length;) { assert.equal(command.readUInt16LE(offset), 0); const tag = command.readUInt16LE(offset + 2), size = command.readUInt32LE(offset + 4); offset += 8; fields.set(tag, command.subarray(offset, offset + size)); offset += size; }
  return { commandField: fields.get(0x0100)?.readUInt16LE(0), messageId: fields.get(0x0110)?.readUInt16LE(0), messageIdBeingRespondedTo: fields.get(0x0120)?.readUInt16LE(0) };
}

function implicitValues(bytes) {
  const values = new Map();
  for (let offset = 0; offset + 8 <= bytes.length;) { const key = bytes.readUInt16LE(offset).toString(16).padStart(4,'0') + bytes.readUInt16LE(offset + 2).toString(16).padStart(4,'0'); const length = bytes.readUInt32LE(offset + 4); offset += 8; values.set(key, bytes.subarray(offset, offset + length).toString('ascii').replace(/[ \0]+$/g,'')); offset += length; }
  return values;
}
function explicitValues(bytes) { const values=new Map(); for(let offset=0;offset+8<=bytes.length;){const key=bytes.readUInt16LE(offset).toString(16).padStart(4,'0')+bytes.readUInt16LE(offset+2).toString(16).padStart(4,'0');const length=bytes.readUInt16LE(offset+6);offset+=8;values.set(key,bytes.subarray(offset,offset+length).toString('ascii').replace(/[ \0]+$/g,''));offset+=length;}return values; }

export async function startStudyQueryPeer(scenario = {}) {
  const sockets = new Set(); const observations = { connections: 0, sopClassUid: '', implementationClassUid: '', queryRetrieveLevel: '', requestTags: [], cancel: null };
  const server = net.createServer(socket => {
    observations.connections += 1; sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket)); let incoming = Buffer.alloc(0);
    socket.on('data', chunk => { incoming = Buffer.concat([incoming, chunk]); while (incoming.length >= 6 && incoming.length >= 6 + incoming.readUInt32BE(2)) {
      const type = incoming[0], body = incoming.subarray(6, 6 + incoming.readUInt32BE(2)); incoming = incoming.subarray(6 + body.length);
      if (type === 1) {
        observations.sopClassUid = body.includes(Buffer.from(STUDY_ROOT)) ? STUDY_ROOT : '';
        observations.implementationClassUid = body.includes(Buffer.from(KAIRO_IMPLEMENTATION)) ? KAIRO_IMPLEMENTATION : '';
        if (scenario.associationRejected) { socket.write(pdu(3,Buffer.from([0,1,1,7]))); continue; }
        if (scenario.malformedAssociation) { socket.write(pdu(2,Buffer.alloc(4))); continue; }
        const syntax=scenario.transferSyntax==='explicit'?EXPLICIT:IMPLICIT;
        const result = scenario.contextRejected ? 3 : 0;
        const context = itemPart(0x21, Buffer.concat([Buffer.from([1, 0, result, 0]), itemPart(0x40, Buffer.from(syntax))]));
        socket.write(pdu(2, Buffer.concat([body.subarray(0,68), itemPart(0x10,Buffer.from(APPLICATION)), context, itemPart(0x50,itemPart(0x51,be32(16384)))])));
      } else if (type === 4) {
        const metadata = commandMetadata(body);
        if (metadata.commandField === 0x0020) {
          if (scenario.abortWithoutImplementationClass && !observations.implementationClassUid) { socket.write(pdu(7,Buffer.from([0,0,0,0]))); continue; }
          if (scenario.abortAfterFind) { socket.write(pdu(7,Buffer.from([0,0,0,0]))); continue; }
          if (scenario.malformedResponse) { socket.write(pdu(4,Buffer.from([0,0,0,9,1]))); continue; }
          const firstLength = body.readUInt32BE(0), dataOffset = 4 + firstLength;
          const syntax=scenario.transferSyntax==='explicit'?EXPLICIT:IMPLICIT;
          if (dataOffset + 6 <= body.length) { const data=body.subarray(dataOffset + 6, dataOffset + 4 + body.readUInt32BE(dataOffset)); const values=syntax===EXPLICIT?explicitValues(data):implicitValues(data); observations.queryRetrieveLevel=values.get('00080052')??''; observations.requestTags=[...values.keys()]; }
          if (scenario.abortOnUnsorted && observations.requestTags.some((tag,index,tags)=>index>0&&tag<tags[index-1])) { socket.write(pdu(7,Buffer.from([0,0,0,0]))); continue; }
          const responses = (scenario.responses ?? []).map(response => { const data = response.item ? identifier(response.item,syntax) : null; const command=responseCommand(response.status,Boolean(data),response.datasetType); return scenario.separateResponsePdus&&data?separateDataPdus(command,data):scenario.fragmented?fragmentedPdus(command,data):dataPdu(command,data); });
          if (responses.length) socket.write(Buffer.concat(responses));
        } else if (metadata.commandField === 0x0fff) {
          observations.cancel = metadata;
          if (scenario.closeAfterCancel) socket.end(); else if (scenario.cancelResponseStatus !== undefined) socket.write(dataPdu(responseCommand(scenario.cancelResponseStatus, false)));
        }
      } else if (type === 5) socket.end(pdu(6, Buffer.alloc(4)));
    }});
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, observations, async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}
