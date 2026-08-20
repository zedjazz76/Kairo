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

function resolveCoreSchema(schema) {
  if (!schema.$ref) {
    return schema;
  }

  return commandSchema.$defs[schema.$ref.slice(schema.$ref.lastIndexOf("/") + 1)];
}

function matchesCoreSchema(value, schema) {
  const resolved = resolveCoreSchema(schema);

  if (resolved.const !== undefined && value !== resolved.const) {
    return false;
  }

  if (resolved.enum && !resolved.enum.includes(value)) {
    return false;
  }

  if (resolved.type === "string") {
    if (typeof value !== "string") {
      return false;
    }

    if (resolved.minLength && value.length < resolved.minLength) {
      return false;
    }

    if (
      resolved.format === "uuid" &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
    ) {
      return false;
    }
  }

  if (resolved.type === "array") {
    if (!Array.isArray(value) || (resolved.minItems && value.length < resolved.minItems)) {
      return false;
    }

    if (resolved.items && value.some((item) => !matchesCoreSchema(item, resolved.items))) {
      return false;
    }
  }

  if (
    resolved.type === "object" ||
    resolved.properties ||
    resolved.required
  ) {
    if (!isObject(value)) {
      return false;
    }

    if ((resolved.required ?? []).some((propertyName) => !(propertyName in value))) {
      return false;
    }

    if (
      resolved.additionalProperties === false &&
      Object.keys(value).some(
        (propertyName) => !Object.hasOwn(resolved.properties ?? {}, propertyName)
      )
    ) {
      return false;
    }

    if (
      Object.entries(resolved.properties ?? {}).some(
        ([propertyName, propertySchema]) =>
          propertyName in value &&
          !matchesCoreSchema(value[propertyName], propertySchema)
      )
    ) {
      return false;
    }
  }

  if (
    resolved.oneOf &&
    resolved.oneOf.filter((candidate) => matchesCoreSchema(value, candidate)).length !== 1
  ) {
    return false;
  }

  if (resolved.not && matchesCoreSchema(value, resolved.not)) {
    return false;
  }

  return true;
}

function validateCoreEnvelope(envelopeName, envelope) {
  return {
    valid: matchesCoreSchema(envelope, commandSchema.$defs[envelopeName]),
    issues: []
  };
}

export function validateCoreCommand(command) {
  return validateCoreEnvelope("CoreCommandV1", command);
}

export function validateCoreResult(result) {
  return validateCoreEnvelope("CoreResultV1", result);
}
