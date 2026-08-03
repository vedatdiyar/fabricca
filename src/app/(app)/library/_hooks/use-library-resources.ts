"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BOX_ORDER_WEIGHT } from "@/lib/box-constants";
import {
  getLibraryResourcesAction,
  toggleResourceReadStatusAction,
  deleteLibraryResourceAction,
} from "../actions";
import type { LibraryResourceItem, ThesisBoxType } from "../_types/types";

/**
 * Manages library resource list, selection state, CRUD operations, and data loading.
 *
 * @returns Resource state, sorted list, selection handlers, and mutation callbacks.
 */
export function useLibraryResources() {
  const searchParams = useSearchParams();
  const urlResourceId = searchParams.get("id");
  const initialSelectedId = urlResourceId ? parseInt(urlResourceId, 10) : null;

  const [resources, setResources] = useState<LibraryResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(
    initialSelectedId,
  );
  const [activeTab, setActiveTab] = useState<ThesisBoxType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const initialIdRef = useRef(initialSelectedId);

  const handleSelectResource = useCallback((id: number) => {
    setSelectedResourceId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", id.toString());
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedResourceId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    /**
     * Loads library resources from the server.
     */
    async function loadData() {
      try {
        setIsLoading(true);
        const res = await getLibraryResourcesAction();

        if (res.success && res.data && res.data.resources.length > 0) {
          setResources(res.data.resources);

          const currentId = initialIdRef.current;
          if (currentId) {
            const targetResource = res.data.resources.find(
              (r) => r.id === currentId,
            );
            if (targetResource) {
              setSelectedResourceId(targetResource.id);
            }
          }
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const sortedResources = useMemo(() => {
    return [...resources].sort((a, b) => {
      const aHasPdf = a.pdfStatus && a.pdfStatus !== "NOT_UPLOADED" ? 0 : 1;
      const bHasPdf = b.pdfStatus && b.pdfStatus !== "NOT_UPLOADED" ? 0 : 1;
      if (aHasPdf !== bHasPdf) return aHasPdf - bHasPdf;
      const orderA = BOX_ORDER_WEIGHT[a.boxType] ?? 99;
      const orderB = BOX_ORDER_WEIGHT[b.boxType] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [resources]);

  const handleDeleteResource = useCallback(
    async (resourceId: number) => {
      const res = await deleteLibraryResourceAction(resourceId);
      if (res.success) {
        setResources((prev) => prev.filter((r) => r.id !== resourceId));

        if (selectedResourceId === resourceId) {
          handleClearSelection();
        }

        toast.success("Eser ve tüm ilişkili veriler kalıcı olarak silindi.");
      } else {
        toast.error(res.error || "Eser silinirken bir hata oluştu.");
      }
    },
    [selectedResourceId, handleClearSelection],
  );

  const handleToggleReadStatus = useCallback(
    async (resourceId: number) => {
      const target = resources.find((r) => r.id === resourceId);
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
    [resources],
  );

  const handleUpdateResource = useCallback(
    (updatedResource: LibraryResourceItem) => {
      setResources((prev) =>
        prev.map((item) =>
          item.id === updatedResource.id ? updatedResource : item,
        ),
      );
    },
    [],
  );

  return {
    resources,
    setResources,
    isLoading,
    selectedResourceId,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    sortedResources,
    handleSelectResource,
    handleClearSelection,
    handleDeleteResource,
    handleToggleReadStatus,
    handleUpdateResource,
  };
}
