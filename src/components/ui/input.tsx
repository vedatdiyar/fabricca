import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        aria-label={props["aria-label"] ?? "Input"}
        className={cn(
          "flex h-8 w-full rounded-md border border-border/50 bg-background/40 px-2.5 py-1 text-xs file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground transition-all hover:border-border hover:bg-background/60 focus-visible:border-primary/40 focus-visible:bg-background/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
