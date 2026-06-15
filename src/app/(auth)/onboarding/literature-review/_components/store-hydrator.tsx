"use client";

import { useEffect, useRef } from "react";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { fetchHydrationData } from "../actions";

export function StoreHydrator() {
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;

    const storeState = useOnboardingStore.getState();
    if (storeState.boxes) return;

    hydrated.current = true;

    fetchHydrationData().then((result) => {
      if (result.error || !result.data) return;

      const data = result.data;

      useOnboardingStore.setState({
        formData: data.formData,
        enrichedData: data.enrichedData,
        juryReport: data.juryReport,
        boxes: data.boxes,
        approvedKeywords: data.approvedKeywords,
        currentStep: "literature-review",
        status: {
          matrix: "success",
          enrichment: "success",
          risk: "success",
          boxes: "success",
          "literature-review": useOnboardingStore.getState().status["literature-review"] ?? "idle",
        },
      });
    });
  }, []);

  return null;
}
