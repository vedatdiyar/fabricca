"use client";

import { useReducer, useEffect, useRef, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { compareBoxTypes } from "@/lib/box-constants";
import {
  getLibraryResourcesAction,
  toggleResourceReadStatusAction,
  deleteLibraryResourceAction,
} from "../actions";
import type {
  LibraryOutlineItem,
  LibraryResourceItem,
  ThesisBoxType,
} from "../_lib/types";

interface LibraryResourcesState {
  resources: LibraryResourceItem[];
  outlines: LibraryOutlineItem[];
  isLoading: boolean;
  selectedResourceId: number | null;
  activeTab: ThesisBoxType;
  searchQuery: string;
}

type LibraryResourcesAction =
  | {
      type: "LOAD_SUCCESS";
      payload: {
        outlines: LibraryOutlineItem[];
        resources: LibraryResourceItem[];
        selectedResourceId: number | null;
      };
    }
  | { type: "LOAD_COMPLETE" }
  | {
      type: "SET_RESOURCES";
      payload: React.SetStateAction<LibraryResourceItem[]>;
    }
  | { type: "SET_SELECTED_RESOURCE_ID"; payload: number | null }
  | { type: "SET_ACTIVE_TAB"; payload: ThesisBoxType }
  | { type: "SET_SEARCH_QUERY"; payload: string };

function libraryResourcesReducer(
  state: LibraryResourcesState,
  action: LibraryResourcesAction,
): LibraryResourcesState {
  switch (action.type) {
    case "LOAD_SUCCESS":
      return {
        ...state,
        isLoading: false,
        outlines: action.payload.outlines,
        resources: action.payload.resources,
        selectedResourceId:
          action.payload.selectedResourceId !== null
            ? action.payload.selectedResourceId
            : state.selectedResourceId,
      };
    case "LOAD_COMPLETE":
      return {
        ...state,
        isLoading: false,
      };
    case "SET_RESOURCES": {
      const nextResources =
        typeof action.payload === "function"
          ? action.payload(state.resources)
          : action.payload;
      return {
        ...state,
        resources: nextResources,
      };
    }
    case "SET_SELECTED_RESOURCE_ID":
      return {
        ...state,
        selectedResourceId: action.payload,
      };
    case "SET_ACTIVE_TAB":
      return {
        ...state,
        activeTab: action.payload,
      };
    case "SET_SEARCH_QUERY":
      return {
        ...state,
        searchQuery: action.payload,
      };
    default:
      return state;
  }
}

/**
 * Manages library resource list, selection state, CRUD operations, and data loading.
 *
 * @param initialSelectedId - Resource id read from the URL `id` search param to preselect on load.
 * @returns Resource state, sorted list, selection handlers, and mutation callbacks.
 */
export function useLibraryResources(initialSelectedId: number | null) {
  const [state, dispatch] = useReducer(libraryResourcesReducer, {
    resources: [],
    outlines: [],
    isLoading: true,
    selectedResourceId: initialSelectedId,
    activeTab: "ALL",
    searchQuery: "",
  });

  const initialIdRef = useRef(initialSelectedId);

  const setSelectedResourceId = useCallback((id: number | null) => {
    dispatch({ type: "SET_SELECTED_RESOURCE_ID", payload: id });
  }, []);

  const setResources = useCallback(
    (action: React.SetStateAction<LibraryResourceItem[]>) => {
      dispatch({ type: "SET_RESOURCES", payload: action });
    },
    [],
  );

  const setActiveTab = useCallback((tab: ThesisBoxType) => {
    dispatch({ type: "SET_ACTIVE_TAB", payload: tab });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: "SET_SEARCH_QUERY", payload: query });
  }, []);

  const handleSelectResource = useCallback(
    (id: number) => {
      setSelectedResourceId(id);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("id", id.toString());
        window.history.replaceState({}, "", url.toString());
      }
    },
    [setSelectedResourceId],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedResourceId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
  }, [setSelectedResourceId]);

  useEffect(() => {
    /**
     * Loads library resources from the server.
     */
    async function loadData() {
      try {
        const res = await getLibraryResourcesAction();

        if (res.success && res.data) {
          const currentId = initialIdRef.current;
          let matchedId: number | null = null;

          if (currentId && res.data.resources.length > 0) {
            const target = res.data.resources.find((r) => r.id === currentId);
            if (target) {
              matchedId = target.id;
            }
          }

          dispatch({
            type: "LOAD_SUCCESS",
            payload: {
              outlines: res.data.outlines || [],
              resources: res.data.resources || [],
              selectedResourceId: matchedId,
            },
          });
        } else {
          dispatch({ type: "LOAD_COMPLETE" });
        }
      } catch {
        dispatch({ type: "LOAD_COMPLETE" });
      }
    }

    loadData();
  }, []);

  const sortedResources = useMemo(() => {
    return [...state.resources].sort((a, b) => {
      const aHasPdf = a.pdfStatus && a.pdfStatus !== "NOT_UPLOADED" ? 0 : 1;
      const bHasPdf = b.pdfStatus && b.pdfStatus !== "NOT_UPLOADED" ? 0 : 1;
      if (aHasPdf !== bHasPdf) return aHasPdf - bHasPdf;
      const cmp = compareBoxTypes(a.boxType, b.boxType);
      if (cmp !== 0) return cmp;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [state.resources]);

  const handleDeleteResource = useCallback(
    async (resourceId: number) => {
      const res = await deleteLibraryResourceAction(resourceId);
      if (res.success) {
        setResources((prev) => prev.filter((r) => r.id !== resourceId));

        if (state.selectedResourceId === resourceId) {
          handleClearSelection();
        }

        toast.success("Eser ve tüm ilişkili veriler kalıcı olarak silindi.");
      } else {
        toast.error(res.error || "Eser silinirken bir hata oluştu.");
      }
    },
    [state.selectedResourceId, handleClearSelection, setResources],
  );

  const handleToggleReadStatus = useCallback(
    async (resourceId: number) => {
      const target = state.resources.find((r) => r.id === resourceId);
      if (!target) return;

      const nextStatus = !target.isRead;
      const res = await toggleResourceReadStatusAction(resourceId);

      if (res.success) {
        setResources((prev) =>
          prev.map((item) =>
            item.id === resourceId ? { ...item, isRead: nextStatus } : item,
          ),
        );
        toast.success(
          nextStatus
            ? "Eser 'Okundu' olarak işaretlendi."
            : "Eser 'Okunacak' olarak işaretlendi.",
        );
      } else {
        toast.error(res.error || "Okuma durumu güncellenemedi.");
      }
    },
    [state.resources, setResources],
  );

  const handleUpdateResource = useCallback(
    (updatedResource: LibraryResourceItem) => {
      setResources((prev) =>
        prev.map((item) =>
          item.id === updatedResource.id ? updatedResource : item,
        ),
      );
    },
    [setResources],
  );

  return {
    resources: state.resources,
    setResources,
    outlines: state.outlines,
    isLoading: state.isLoading,
    selectedResourceId: state.selectedResourceId,
    activeTab: state.activeTab,
    setActiveTab,
    searchQuery: state.searchQuery,
    setSearchQuery,
    sortedResources,
    handleSelectResource,
    handleClearSelection,
    handleDeleteResource,
    handleToggleReadStatus,
    handleUpdateResource,
  };
}
