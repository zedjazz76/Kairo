import { readFileSync } from "node:fs";

const answerSchema = JSON.parse(
  readFileSync(new URL("../schemas/kairo-answer.v1.json", import.meta.url), "utf8")
);
const commandSchema = JSON.parse(
  readFileSync(new URL("../schemas/core-command.v1.json", import.meta.url), "utf8")
);

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateKairoAnswer(answer) {
  const issues = [];

  if (!isObject(answer)) {
    return { valid: false, issues: ["answer must be an object"] };
  }

  if (typeof answer.assessment !== "string" || answer.assessment.length === 0) {
    issues.push("assessment must be a non-empty string");
  }

  if (!Array.isArray(answer.claims)) {
    issues.push("claims must be an array");
  } else {
    for (const [index, claim] of answer.claims.entries()) {
      if (!isObject(claim)) {
        issues.push(`claims[${index}] must be an object`);
        continue;
      }

      if (typeof claim.text !== "string" || claim.text.length === 0) {
        issues.push(`claims[${index}].text must be a non-empty string`);
      }

      if (!answerSchema.$defs.KnowledgeScopeV1.enum.includes(claim.scope)) {
        issues.push(`claims[${index}].scope is required and must be recognized`);
      }

      if (
        !answerSchema.$defs.TemporalContextV1.enum.includes(
          claim.temporalContext
        )
      ) {
        issues.push(
          `claims[${index}].temporalContext is required and must be recognized`
        );
      }

      if (!answerSchema.$defs.EvidenceStateV1.enum.includes(claim.evidenceState)) {
        issues.push(
          `claims[${index}].evidenceState is required and must be recognized`
        );
      }

      if (
        !Array.isArray(claim.evidenceRefs) ||
        claim.evidenceRefs.length === 0 ||
        claim.evidenceRefs.some(
          (evidenceRef) =>
            typeof evidenceRef !== "string" || evidenceRef.length === 0
        )
      ) {
        issues.push(
          `claims[${index}].evidenceRefs must contain at least one reference`
        );
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

function validateCoreEnvelope(envelopeName, envelope) {
  const issues = [];
  const envelopeSchema = commandSchema.$defs[envelopeName];

  if (!isObject(envelope)) {
    return { valid: false, issues: [`${envelopeName} must be an object`] };
  }

  for (const propertyName of envelopeSchema.required) {
    if (!(propertyName in envelope)) {
      issues.push(`${propertyName} is required`);
    }
  }

  if (
    typeof envelope.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      envelope.requestId
    )
  ) {
    issues.push("requestId must be a UUID");
  }

  if (
    !commandSchema.$defs.CoreCommandTypeV1.enum.includes(envelope.type)
  ) {
    issues.push("type must be an approved advisory Core capability");
  }

  if (envelope.contractVersion !== "v1") {
    issues.push("contractVersion must be v1");
  }

  if (!isObject(envelope.payload)) {
    issues.push("payload must be an object");
  }

  if (
    envelopeSchema.additionalProperties === false &&
    Object.keys(envelope).some(
      (propertyName) => !Object.hasOwn(envelopeSchema.properties, propertyName)
    )
  ) {
    issues.push("unexpected envelope property");
  }

  return { valid: issues.length === 0, issues };
}

export function validateCoreCommand(command) {
  return validateCoreEnvelope("CoreCommandV1", command);
}

export function validateCoreResult(result) {
  return validateCoreEnvelope("CoreResultV1", result);
}
