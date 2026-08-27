import type { Matrix } from "@/core/db/schema";
import type { ThesisMatrix } from "@/lib/types";
import type { ChatMessage } from "../_components/advisor-chat";
import type { MatrixFieldKey } from "../_services/rubrics";

export const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-1",
  role: "model",
  content:
    "Hoş geldiniz. Aklınızdaki tez fikrini enstitü ve jüri standartlarında sağlam bir araştırma zeminine oturtmak için buradayım.\n\nBaşlangıç olarak; üzerinde çalışmayı düşündüğünüz o ham fikir, sizi bu alana çeken temel olgu veya çözülmesini arzuladığınız mesele nedir?",
};

export interface MatrixOnboardingState {
  activeMode: "advisor" | "classic";
  selectedSegment: MatrixFieldKey | null;
  isReviewOpen: boolean;
  matrix: Partial<ThesisMatrix>;
  messages: ChatMessage[];
  isLoading: boolean;
  streamingText: string;
  statusMessage: string | null;
  isSubmitting: boolean;
  isSyncing: boolean;
}

export type MatrixOnboardingAction =
  | { type: "SET_ACTIVE_MODE"; payload: "advisor" | "classic" }
  | { type: "SET_SELECTED_SEGMENT"; payload: MatrixFieldKey | null }
  | { type: "SET_IS_REVIEW_OPEN"; payload: boolean }
  | {
      type: "SET_MATRIX";
      payload:
        | Partial<ThesisMatrix>
        | ((prev: Partial<ThesisMatrix>) => Partial<ThesisMatrix>);
    }
  | {
      type: "UPDATE_MATRIX_FIELD";
      payload: { field: MatrixFieldKey; value: string };
    }
  | {
      type: "SET_MESSAGES";
      payload: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]);
    }
  | { type: "SET_IS_LOADING"; payload: boolean }
  | { type: "SET_STREAMING_TEXT"; payload: string }
  | { type: "SET_STATUS_MESSAGE"; payload: string | null }
  | { type: "SET_IS_SUBMITTING"; payload: boolean }
  | { type: "SET_IS_SYNCING"; payload: boolean }
  | {
      type: "RESET_MATRIX";
      payload: {
        matrix: Partial<ThesisMatrix>;
        messages: ChatMessage[];
      };
    };

/**
 * Creates the initial state for Matrix Onboarding based on persisted DB values.
 *
 * @param initialMatrix - Persisted thesis matrix from DB if available.
 * @returns Fresh initial state for the reducer.
 */
export function createInitialMatrixOnboardingState(
  initialMatrix?: Matrix | null,
): MatrixOnboardingState {
  return {
    activeMode: "advisor",
    selectedSegment: null,
    isReviewOpen: false,
    matrix: {
      subjectProblem: initialMatrix?.subjectProblem ?? "",
      theoreticalFramework: initialMatrix?.theoreticalFramework ?? "",
      primaryMaterial: initialMatrix?.primaryMaterial ?? "",
      methodology: initialMatrix?.methodology ?? "",
    },
    messages:
      initialMatrix?.advisorMessages && initialMatrix.advisorMessages.length > 0
        ? initialMatrix.advisorMessages
        : [WELCOME_MESSAGE],
    isLoading: false,
    streamingText: "",
    statusMessage: null,
    isSubmitting: false,
    isSyncing: false,
  };
}

/**
 * Pure reducer function for Matrix Onboarding state transitions.
 *
 * @param state - Current state snapshot.
 * @param action - Dispatched action.
 * @returns Next state snapshot.
 */
export function matrixOnboardingReducer(
  state: MatrixOnboardingState,
  action: MatrixOnboardingAction,
): MatrixOnboardingState {
  switch (action.type) {
    case "SET_ACTIVE_MODE":
      return { ...state, activeMode: action.payload };
    case "SET_SELECTED_SEGMENT":
      return { ...state, selectedSegment: action.payload };
    case "SET_IS_REVIEW_OPEN":
      return { ...state, isReviewOpen: action.payload };
    case "SET_MATRIX": {
      const nextMatrix =
        typeof action.payload === "function"
          ? action.payload(state.matrix)
          : action.payload;
      return { ...state, matrix: nextMatrix };
    }
    case "UPDATE_MATRIX_FIELD":
      return {
        ...state,
        matrix: {
          ...state.matrix,
          [action.payload.field]: action.payload.value,
        },
      };
    case "SET_MESSAGES": {
      const nextMessages =
        typeof action.payload === "function"
          ? action.payload(state.messages)
          : action.payload;
      return { ...state, messages: nextMessages };
    }
    case "SET_IS_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_STREAMING_TEXT":
      return { ...state, streamingText: action.payload };
    case "SET_STATUS_MESSAGE":
      return { ...state, statusMessage: action.payload };
    case "SET_IS_SUBMITTING":
      return { ...state, isSubmitting: action.payload };
    case "SET_IS_SYNCING":
      return { ...state, isSyncing: action.payload };
    case "RESET_MATRIX":
      return {
        ...state,
        matrix: action.payload.matrix,
        messages: action.payload.messages,
      };
    default:
      return state;
  }
}
