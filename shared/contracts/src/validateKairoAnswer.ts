import { readFileSync } from "node:fs";

const schema = JSON.parse(
  readFileSync(new URL("../schemas/kairo-answer.v1.json", import.meta.url), "utf8")
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

      if (!schema.$defs.knowledgeScope.enum.includes(claim.scope)) {
        issues.push(`claims[${index}].scope is required and must be recognized`);
      }

      if (!schema.$defs.evidenceState.enum.includes(claim.evidenceState)) {
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
