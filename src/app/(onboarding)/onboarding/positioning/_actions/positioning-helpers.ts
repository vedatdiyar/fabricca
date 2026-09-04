import { positioningMatrixSchema } from "../_services/validation";
import type { ThesisMatrix } from "@/lib/types";

/**
 * Parses and validates thesis matrix input for positioning flow.
 *
 * @param matrixInput - Raw thesis matrix.
 * @returns Validated matrix or error message.
 */
export function parsePositioningMatrixInput(matrixInput: ThesisMatrix):
  | {
      success: true;
      data: {
        subjectProblem: string;
        theoreticalFramework: string;
        primaryMaterial?: string;
        methodology: string;
      };
    }
  | { success: false; error: string } {
  const positioningInput: Record<string, string> = {
    subjectProblem: matrixInput.subjectProblem ?? "",
    theoreticalFramework: matrixInput.theoreticalFramework ?? "",
    primaryMaterial: matrixInput.primaryMaterial ?? "",
    methodology: matrixInput.methodology ?? "",
  };

  const parsed = positioningMatrixSchema.safeParse(positioningInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Form doğrulaması başarısız.";
    return { success: false, error: msg };
  }

  return { success: true, data: parsed.data };
}

