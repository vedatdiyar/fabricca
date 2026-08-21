"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  labels: Record<string, React.ReactNode>;
  registerLabel: (val: string, label: React.ReactNode) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

/** Props for Select root component. */
export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

/**
 * Root context container for custom select dropdown.
 *
 * @param props - Root select props.
 * @returns Select context markup.
 */
export function Select(props: SelectProps) {
  const { value, onValueChange, children } = props;
  const [open, setOpen] = React.useState(false);
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>(
    {},
  );

  const registerLabel = React.useCallback(
    (val: string, label: React.ReactNode) => {
      setLabels((prev) =>
        prev[val] === label ? prev : { ...prev, [val]: label },
      );
    },
    [],
  );

  return (
    <SelectContext.Provider
      value={{ value, onValueChange, open, setOpen, labels, registerLabel }}
    >
      <div className={cn("relative inline-block w-full", open && "z-50")}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

/** Props for SelectTrigger element. */
export type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Trigger button opening the select option list.
 *
 * @param props - Component props.
 * @returns SelectTrigger markup.
 */
export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  SelectTriggerProps
>((props, ref) => {
  const { className, children, ...rest } = props;
  const ctx = React.useContext(SelectContext);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => ctx?.setOpen((prev) => !prev)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs ring-offset-background placeholder:text-muted-foreground hover:border-primary/20 focus:outline-hidden focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors text-left",
        className,
      )}
      {...rest}
    >
      <span className="flex items-center gap-2 min-w-0 truncate text-left">
        {children}
      </span>
      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-1" />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

/** Props for SelectValue placeholder/value display. */
export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
}

/**
 * Displays active label or fallback placeholder.
 *
 * @param props - SelectValue props.
 * @returns SelectValue markup.
 */
export function SelectValue(props: SelectValueProps) {
  const { placeholder, children, className, ...rest } = props;
  const ctx = React.useContext(SelectContext);

  const activeLabel =
    ctx?.value && ctx.labels[ctx.value] ? ctx.labels[ctx.value] : null;

  return (
    <span className={cn("truncate text-left", className)} {...rest}>
      {children ?? activeLabel ?? placeholder ?? ctx?.value}
    </span>
  );
}

/** Props for SelectContent container. */
export type SelectContentProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Popup container holding selectable items.
 *
 * @param props - Content props.
 * @returns SelectContent markup.
 */
export const SelectContent = React.forwardRef<
  HTMLDivElement,
  SelectContentProps
>((props, ref) => {
  const { className, children, ...rest } = props;
  const ctx = React.useContext(SelectContext);

  if (!ctx?.open) return null;

  return (
    <>
      {/* Backdrop for closing */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="fixed inset-0 z-40"
        onClick={() => ctx.setOpen(false)}
      />
      <div
        ref={ref}
        role="listbox"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            ctx?.setOpen(false);
          }
        }}
        className={cn(
          "absolute left-0 top-full mt-1 z-50 max-h-60 w-full min-w-[8rem] overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md backdrop-blur-md animate-in fade-in-80",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    </>
  );
});
SelectContent.displayName = "SelectContent";

/** Props for SelectItem element. */
export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

/**
 * Individual select option item.
 *
 * @param props - Item props.
 * @returns SelectItem markup.
 */
export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  (props, ref) => {
    const { className, value, children, disabled, onClick, ...rest } = props;
    const ctx = React.useContext(SelectContext);

    const isSelected = ctx?.value === value;

    React.useEffect(() => {
      ctx?.registerLabel(value, children);
    }, [ctx, value, children]);

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (disabled) return;
            ctx?.onValueChange?.(value);
            ctx?.setOpen(false);
            onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
          } else if (e.key === "Escape") {
            ctx?.setOpen(false);
          }
        }}
        onClick={(e) => {
          if (disabled) return;
          ctx?.onValueChange?.(value);
          ctx?.setOpen(false);
          onClick?.(e);
        }}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center justify-between rounded-sm py-2 px-2 text-xs outline-hidden hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
          isSelected && "bg-accent/60 font-medium text-accent-foreground",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        {...rest}
      >
        <span className="truncate">{children}</span>
        {isSelected && (
          <Check className="h-3.5 w-3.5 ml-2 text-primary shrink-0" />
        )}
      </div>
    );
  },
);
SelectItem.displayName = "SelectItem";
