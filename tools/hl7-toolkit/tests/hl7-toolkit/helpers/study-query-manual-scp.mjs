import { pathToFileURL } from 'node:url';
import { startStudyQueryPeer } from './study-query-peer.mjs';

const record=(number,overrides={})=>({patientName:`TEST^STUDY${number}`,patientId:`KAIRO-QR-00${number}`,accessionNumber:`KAIROQR00${number}`,studyDate:'20260907',studyTime:`1${number}0000`,studyDescription:`Synthetic study ${number}`,modalitiesInStudy:number===2?'CT':'MR',studyInstanceUid:`1.2.840.999.7.3.${number}`,numberOfStudyRelatedSeries:String(number+1),numberOfStudyRelatedInstances:String(number*4),referringPhysicianName:'TEST^REFERRER',...overrides});

export function manualStudyQueryConfiguration(name) {
  const common={host:'127.0.0.1',calledAe:'TEST_QR',callingAe:'KAIRO',patientId:'',studyInstanceUid:'',studyDate:'',modalitiesInStudy:''};
  if(name==='zero')return{...common,label:'TEST A — SUCCESSFUL ZERO MATCHES',accessionNumber:'NO-SUCH-STUDY',scenario:{responses:[{status:0x0000}]}};
  if(name==='one'){const study=record(1,{patientName:'TEST^STUDY',accessionNumber:'KAIROQR001'});return{...common,label:'TEST B — ONE SYNTHETIC STUDY',accessionNumber:'KAIROQR001',scenario:{responses:[{status:0xff00,item:study},{status:0x0000}]}};}
  if(name==='multiple')return{...common,label:'TEST C — THREE SYNTHETIC STUDIES',accessionNumber:'',patientId:'KAIRO-QR',scenario:{responses:[1,2,3].map(number=>({status:0xff00,item:record(number)})).concat({status:0x0000})}};
  if(name==='cap')return{...common,label:'TEST D — 100-RESULT SAFETY CAP',accessionNumber:'',patientId:'KAIRO-CAP',scenario:{
    responses:Array.from({length:101},(_,index)=>({status:0xff00,item:record((index%9)+1,{patientId:`KAIRO-CAP-${String(index+1).padStart(3,'0')}`,studyInstanceUid:`1.2.840.999.7.3.100.${index+1}`})})),
    cancelResponseStatus:0xfe00
  }};
  throw new Error('SCENARIO must be zero, one, multiple, or cap');
}

async function run(){const configuration=manualStudyQueryConfiguration(process.argv[2]);const peer=await startStudyQueryPeer(configuration.scenario);const shown=value=>value||'(leave blank)';process.stdout.write(`${configuration.label}\n\nHOST/IP: ${configuration.host}\nPORT: ${peer.port}\nCALLED AE: ${configuration.calledAe}\nCALLING AE: ${configuration.callingAe}\nACCESSION: ${shown(configuration.accessionNumber)}\nPATIENT ID: ${shown(configuration.patientId)}\nSTUDY INSTANCE UID: ${shown(configuration.studyInstanceUid)}\nSTUDY DATE: ${shown(configuration.studyDate)}\nMODALITIES IN STUDY: ${shown(configuration.modalitiesInStudy)}\n\nStudy Root SCP is listening on loopback only. Keep this window open while testing. Press Ctrl+C to stop.\n`);await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});await peer.close();}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{process.stderr.write(`Unable to start controlled Study Root SCP: ${error.message}\n`);process.exitCode=1;});
