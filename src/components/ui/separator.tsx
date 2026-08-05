"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Props for Separator component. */
export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

/**
 * Renders a visual or semantically meaningful divider between content sections.
 *
 * @param props - Component props including orientation and styling classes.
 * @returns Separator component markup.
 */
export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (props, ref) => {
    const { className, orientation = "horizontal", ...rest } = props;
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={cn(
          "shrink-0 bg-border/60",
          orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
          className,
        )}
        {...rest}
      />
    );
  },
);
Separator.displayName = "Separator";
