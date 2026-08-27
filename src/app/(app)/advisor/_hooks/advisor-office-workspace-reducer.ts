import type { OutlineOption, OfficeSessionSummary } from "../office-actions";
import type {
  OfficeReviewReport,
  JuryCritique,
} from "../_services/pipeline/types";
import type { DefenseMessage } from "../_components/office-defense-chat";

export interface AdvisorOfficeWorkspaceState {
  initialData: {
    isLoading: boolean;
    outlines: OutlineOption[];
    sessions: OfficeSessionSummary[];
  };
  sessionDetail: {
    activeSessionId: number | null;
    currentReport: OfficeReviewReport | null;
    activeOutlineId: number | null;
    activeOutlineTitle: string;
  };
  defenseState: {
    messages: DefenseMessage[];
    hasStarted: boolean;
    isStreaming: boolean;
    activeCritique: JuryCritique | null;
  };
  uiState: {
    isSubmittingReview: boolean;
    isDefenseModalOpen: boolean;
    mobileSubmissionTab: "form" | "history";
  };
}

export type AdvisorOfficeWorkspaceAction =
  | {
      type: "INIT_SUCCESS";
      payload: {
        outlines: OutlineOption[];
        sessions: OfficeSessionSummary[];
        sessionDetail?: AdvisorOfficeWorkspaceState["sessionDetail"];
        defenseState?: AdvisorOfficeWorkspaceState["defenseState"];
      };
    }
  | { type: "INIT_FAILED" }
  | {
      type: "SET_INITIAL_DATA";
      payload: React.SetStateAction<AdvisorOfficeWorkspaceState["initialData"]>;
    }
  | {
      type: "SET_SESSION_DETAIL";
      payload: React.SetStateAction<
        AdvisorOfficeWorkspaceState["sessionDetail"]
      >;
    }
  | {
      type: "SET_DEFENSE_STATE";
      payload: React.SetStateAction<
        AdvisorOfficeWorkspaceState["defenseState"]
      >;
    }
  | {
      type: "SET_UI_STATE";
      payload: React.SetStateAction<AdvisorOfficeWorkspaceState["uiState"]>;
    };

/**
 * Creates the initial state for the Advisor Office workspace.
 *
 * @param initialSessionId - Optional session id to preload on mount.
 * @returns Initial workspace state snapshot.
 */
export function createInitialOfficeWorkspaceState(
  initialSessionId?: number,
): AdvisorOfficeWorkspaceState {
  return {
    initialData: {
      isLoading: true,
      outlines: [],
      sessions: [],
    },
    sessionDetail: {
      activeSessionId: initialSessionId || null,
      currentReport: null,
      activeOutlineId: null,
      activeOutlineTitle: "",
    },
    defenseState: {
      messages: [],
      hasStarted: false,
      isStreaming: false,
      activeCritique: null,
    },
    uiState: {
      isSubmittingReview: false,
      isDefenseModalOpen: false,
      mobileSubmissionTab: "form",
    },
  };
}

/**
 * Pure reducer function managing state transitions for the Advisor Office workspace.
 *
 * @param state - Current workspace state snapshot.
 * @param action - Dispatched action.
 * @returns Next workspace state snapshot.
 */
export function advisorOfficeWorkspaceReducer(
  state: AdvisorOfficeWorkspaceState,
  action: AdvisorOfficeWorkspaceAction,
): AdvisorOfficeWorkspaceState {
  switch (action.type) {
    case "INIT_SUCCESS":
      return {
        ...state,
        initialData: {
          isLoading: false,
          outlines: action.payload.outlines,
          sessions: action.payload.sessions,
        },
        sessionDetail: action.payload.sessionDetail ?? state.sessionDetail,
        defenseState: action.payload.defenseState ?? state.defenseState,
      };
    case "INIT_FAILED":
      return {
        ...state,
        initialData: {
          ...state.initialData,
          isLoading: false,
        },
      };
    case "SET_INITIAL_DATA":
      return {
        ...state,
        initialData:
          typeof action.payload === "function"
            ? action.payload(state.initialData)
            : action.payload,
      };
    case "SET_SESSION_DETAIL":
      return {
        ...state,
        sessionDetail:
          typeof action.payload === "function"
            ? action.payload(state.sessionDetail)
            : action.payload,
      };
    case "SET_DEFENSE_STATE":
      return {
        ...state,
        defenseState:
          typeof action.payload === "function"
            ? action.payload(state.defenseState)
            : action.payload,
      };
    case "SET_UI_STATE":
      return {
        ...state,
        uiState:
          typeof action.payload === "function"
            ? action.payload(state.uiState)
            : action.payload,
      };
    default:
      return state;
  }
}

/**
 * Builds normalized sessionDetail and defenseState payloads from a raw session detail response.
 *
 * @param detail - Raw office session detail object.
 * @param outlineList - Optional list of outlines to match section titles.
 * @returns Structured sessionDetail and defenseState objects.
 */
export function buildOfficeSessionPayload(
  detail: {
    id: number;
    outlineId: number | null;
    outlineTitle?: string | null;
    reviewReport: OfficeReviewReport | null;
    messages: Array<{
      id: number;
      role: string;
      content: string;
      pipelineData?: unknown;
      createdAt: string;
    }>;
  },
  outlineList?: OutlineOption[],
): {
  sessionDetail: AdvisorOfficeWorkspaceState["sessionDetail"];
  defenseState: AdvisorOfficeWorkspaceState["defenseState"];
} {
  const outlineMatch = outlineList?.find((o) => o.id === detail.outlineId);
  const chatMsgs: DefenseMessage[] = detail.messages
    .filter(
      (m) => m.role === "user" || (m.role === "assistant" && !m.pipelineData),
    )
    .map((m) => ({
      id: m.id,
      role: m.role as "assistant" | "user",
      content: m.content,
      createdAt: m.createdAt,
    }));

  return {
    sessionDetail: {
      activeSessionId: detail.id,
      currentReport: detail.reviewReport,
      activeOutlineId: detail.outlineId,
      activeOutlineTitle:
        detail.outlineTitle || outlineMatch?.title || "Tez Bölümü",
    },
    defenseState: {
      messages: chatMsgs,
      hasStarted: chatMsgs.length > 0,
      isStreaming: false,
      activeCritique: null,
    },
  };
}
