import { parseHl7, getValue } from './hl7-parser.mjs';
import { hashMessage, validateBasic } from './validator.mjs';
import { analyzeAck } from './ack.mjs';
import { historySafeText } from './sanitizer.mjs';
import { countWarningTypes } from './clipboard.mjs';

export function createSingleSender({ getSnapshot, historyReady, sanitize, saveEvent, send, confirm }) {
  let busy = false;
  return {
    get busy() { return busy; },
    async run() {
      if (busy) throw new Error('SEND_ALREADY_RUNNING');
      busy = true;
      try {
        const snapshot = getSnapshot();
        if (!snapshot?.text) throw new Error('SELECT_ONE_MESSAGE');
        if (snapshot.dirty) throw new Error('APPLY_EDITS_FIRST');
        const fingerprint = JSON.stringify(snapshot);
        const assertCurrent = () => { if (JSON.stringify(getSnapshot()) !== fingerprint) throw new Error('SEND_REVIEW_EXPIRED'); };
        await historyReady();
        const synthetic = snapshot.mode === 'sanitized' ? await sanitize(snapshot.text, 'synthetic-test') : null;
        const message = (synthetic?.text || snapshot.text).replace(/\r\n|\n/g, '\r');
        const findings = [...new Map([...validateBasic(parseHl7(message)), ...(snapshot.findings || [])].map((finding) => [finding.id, finding])).values()];
        if (findings.some((finding) => finding.severity === 'error' && !finding.overridable)) throw new Error('SEND_ONE_MESSAGE_REQUIRED');
        const warnings = [...findings.filter((finding) => ['error', 'warning'].includes(finding.severity)), ...(synthetic?.warnings || [])];
        const requiredIds = [...new Set(warnings.map((warning) => warning.id))];
        const review = await confirm({ kind: 'review', profile: snapshot.profile, message, mode: snapshot.mode, findings, warnings, requiredIds });
        if (!review?.confirmed) return { status: 'canceled' };
        if (requiredIds.some((id) => !review.acknowledgedIds?.includes(id))) throw new Error('REVIEW_WARNINGS_REQUIRED');
        let productionConfirmed = false;
        if (snapshot.mode === 'original' && snapshot.profile.environment === 'Production') {
          productionConfirmed = Boolean((await confirm({ kind: 'production', profile: snapshot.profile }))?.confirmed);
          if (!productionConfirmed) return { status: 'canceled' };
        }
        assertCurrent();
        const sanitized = await sanitize(message, 'chat-safe');
        const audit = { schema: 'hl7-toolkit.sanitized-event.v1', type: 'send-result', sanitizedText: historySafeText(sanitized),
          policyVersion: sanitized.policyVersion, mode: 'chat-safe', warningCounts: countWarningTypes(sanitized.warnings),
          overrideCount: requiredIds.length, profileLabel: snapshot.profile.label, outcome: 'authorized' };
        await saveEvent(audit);
        await historyReady();
        assertCurrent();
        const payload = { requestId: crypto.randomUUID(), profile: snapshot.profile, message, messageHash: await hashMessage(message), contentMode: snapshot.mode, reviewed: true, productionConfirmed };
        assertCurrent();
        let result;
        try { result = await send(payload); }
        catch (error) {
          const rejectedBeforeWrite = error.httpStatus === 400 && (/^PROFILE_/.test(error.message) || [
            'SEND_ONE_MESSAGE_REQUIRED', 'SEND_ENCODING_UNSUPPORTED_CHARACTER', 'SEND_EMBEDDED_FRAMING', 'SEND_REVIEW_REQUIRED',
            'SEND_REVIEW_EXPIRED', 'SEND_PRODUCTION_CONFIRMATION_REQUIRED', 'SEND_MODE_REQUIRED', 'SEND_REQUEST_ID_REQUIRED', 'SEND_SESSION_LIMIT',
          ].includes(error.message));
          result = { status: rejectedBeforeWrite ? 'send-failed' : 'unknown-delivery', deliveryUncertain: !rejectedBeforeWrite,
            ...(rejectedBeforeWrite ? { writeAttempted: false, errorCode: error.message } : { helperResponseLost: true }), bytesSent: 0, latencyMs: 0, response: '' };
        }
        const ack = analyzeAck(result.response || '', getValue(parseHl7(message), 'MSH-10'));
        if (result.status === 'response' && (!ack.valid || !ack.correlated)) result.deliveryUncertain = true;
        let historySaved = false;
        try {
          const response = result.response ? await sanitize(result.response, 'chat-safe') : null;
          await saveEvent({ ...audit, outcome: result.status, sanitizedResponse: response ? historySafeText(response) : '', bytesSent: result.bytesSent || 0,
            latencyMs: result.latencyMs || 0, ackCode: ack.valid ? ack.code : 'UNKNOWN', correlated: ack.correlated });
          historySaved = true;
        } catch { /* Preserve the observed network result. A logging failure must never trigger another send. */ }
        return { ...result, ack, historySaved };
      } finally { busy = false; }
    },
  };
}
