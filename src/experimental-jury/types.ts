export interface ThesisMatrix {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  mainClaim: string;
}

export interface AxisBooleans {
  subject: boolean;
  theory: boolean;
  methodology: boolean;
  context: boolean;
  FINAL: boolean;
}

export interface BooleanScorecard {
  subject: AxisBooleans;
  theory: AxisBooleans;
  methodology: AxisBooleans;
  context: AxisBooleans;
}

export type JuryVerdict = "RISK" | "LITERATURE_GAP" | "EMPIRICAL_FUEL" | "NOISE";
