import type { JuryVerdict } from "./types";

export interface JuryRawData {
  subject_has_same_primary_actor: boolean;
  subject_has_secondary_layer: boolean;
  theory_has_same_primary_framework: boolean;
  theory_has_secondary_framework: boolean;
  context_spatial_match: boolean;
  context_temporal_covers: boolean;
  mainClaimMatched: boolean;
}

export class JuryEngine {
  static classify(data: JuryRawData): JuryVerdict {
    const sameSubject = data.subject_has_same_primary_actor;
    const sameTheory =
      data.theory_has_same_primary_framework &&
      !data.theory_has_secondary_framework;
    const contextMatch =
      data.context_spatial_match && data.context_temporal_covers;
    const subjectExact =
      data.subject_has_same_primary_actor &&
      !data.subject_has_secondary_layer;

    // -- The Gatekeeper --
    if (!sameSubject && !contextMatch) {
      return "NOISE";
    }

    // -- RISK: everything matches exactly --
    if (subjectExact && contextMatch && sameTheory && data.mainClaimMatched) {
      return "RISK";
    }

    // -- LITERATURE_GAP: subject exact + context match but theory or main claim differ --
    if (subjectExact && contextMatch) {
      return "LITERATURE_GAP";
    }

    // -- EMPIRICAL_FUEL: context matches but subject has secondary layer or different actor --
    if (!subjectExact && contextMatch) {
      return "EMPIRICAL_FUEL";
    }

    return "NOISE";
  }
}
