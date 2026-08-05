"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

/** Props for Tabs root component. */
export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Root container for tabs component providing active tab context.
 *
 * @param props - Root component props including active value and change handler.
 * @returns Tabs container markup.
 */
export function Tabs(props: TabsProps) {
  const { value, onValueChange, className, children, ...rest } = props;

  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

/** Props for TabsList container. */
export type TabsListProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Container for tab trigger buttons.
 *
 * @param props - Component props.
 * @returns TabsList markup.
 */
export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  (props, ref) => {
    const { className, ...rest } = props;
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
          className,
        )}
        {...rest}
      />
    );
  },
);
TabsList.displayName = "TabsList";

/** Props for TabsTrigger button. */
export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

/**
 * Individual tab button trigger.
 *
 * @param props - Trigger props including tab value.
 * @returns TabsTrigger markup.
 */
export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>((props, ref) => {
  const { className, value, children, ...rest } = props;
  const ctx = React.useContext(TabsContext);
  const isActive = ctx?.value === value;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx?.onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-background text-foreground shadow-xs"
          : "hover:bg-background/50 hover:text-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = "TabsTrigger";

/** Props for TabsContent container. */
export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

/**
 * Tab panel content corresponding to a tab trigger value.
 *
 * @param props - Content props including value.
 * @returns TabsContent markup.
 */
export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  (props, ref) => {
    const { className, value, children, ...rest } = props;
    const ctx = React.useContext(TabsContext);

    if (ctx?.value !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn(
          "mt-2 ring-offset-background focus-visible:outline-hidden",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
TabsContent.displayName = "TabsContent";
