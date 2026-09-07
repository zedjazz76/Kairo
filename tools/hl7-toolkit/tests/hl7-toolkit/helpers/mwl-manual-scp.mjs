import { pathToFileURL } from 'node:url';
import { startMwlPeer } from './mwl-peer.mjs';

const localDicomDate = (now = new Date()) => {
  const part = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}`;
};

const uiDate = dicomDate => `${dicomDate.slice(0, 4)}-${dicomDate.slice(4, 6)}-${dicomDate.slice(6, 8)}`;

const syntheticRecord = (number, scheduledDate, overrides = {}) => ({
  patientName: `TEST^MWL${number}`,
  patientId: `KAIRO-MWL-00${number}`,
  accessionNumber: `KAIROACC00${number}`,
  requestedProcedureId: `KAIROPROC00${number}`,
  requestedProcedureDescription: `Synthetic procedure ${number}`,
  scheduledProcedureStep: {
    scheduledStationAe: 'KAIRO_MR',
    scheduledDate,
    scheduledTime: `1${number}0000`,
    modality: 'MR',
    scheduledLocation: `SYNTHETIC ROOM ${number}`
  },
  ...overrides
});

export function manualMwlConfiguration(name, dicomDate = localDicomDate()) {
  const common = { host: '127.0.0.1', calledAe: 'TEST_MWL', callingAe: 'KAIRO', scheduledDate: uiDate(dicomDate) };
  if (name === 'zero') return { ...common, label: 'TEST A — ZERO MATCHES', modality: '', accession: '', patientId: '', scheduledStationAe: '', scenario: { responses: [{ status: 0x0000 }] } };
  if (name === 'one') {
    const record = syntheticRecord(1, dicomDate, { patientName: 'TEST^MWL', requestedProcedureDescription: 'Synthetic MRI' });
    return { ...common, label: 'TEST B — ONE SYNTHETIC MATCH', modality: 'MR', accession: 'KAIROACC001', patientId: 'KAIRO-MWL-001', scheduledStationAe: 'KAIRO_MR', scenario: { responses: [{ status: 0xff00, item: record }, { status: 0x0000 }] } };
  }
  if (name === 'multiple') return { ...common, label: 'TEST C — MULTIPLE SYNTHETIC MATCHES', modality: 'MR', accession: '', patientId: '', scheduledStationAe: 'KAIRO_MR', scenario: { responses: [...[1, 2, 3].map(number => ({ status: 0xff00, item: syntheticRecord(number, dicomDate) })), { status: 0x0000 }] } };
  throw new Error('SCENARIO must be zero, one, or multiple');
}

async function run() {
  const configuration = manualMwlConfiguration(process.argv[2]);
  const peer = await startMwlPeer(configuration.scenario);
  const shown = value => value || '(leave blank)';
  process.stdout.write(`${configuration.label}\n\nHOST/IP: ${configuration.host}\nPORT: ${peer.port}\nCALLED AE: ${configuration.calledAe}\nCALLING AE to enter in Kairo: ${configuration.callingAe}\nSCHEDULED DATE: ${configuration.scheduledDate}\nMODALITY: ${shown(configuration.modality)}\nACCESSION: ${shown(configuration.accession)}\nPATIENT ID: ${shown(configuration.patientId)}\nSCHEDULED STATION AE: ${shown(configuration.scheduledStationAe)}\n\nSCP is listening on loopback only. Keep this window open while testing. Press Ctrl+C to stop.\n`);
  await new Promise(resolve => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
  await peer.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    process.stderr.write(`Unable to start controlled MWL SCP: ${error.message}\n`);
    process.exitCode = 1;
  });
}
