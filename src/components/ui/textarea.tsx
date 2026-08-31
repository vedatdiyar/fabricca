import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      aria-label={props["aria-label"] ?? "Textarea"}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-border/50 bg-background/40 px-3 py-2 text-xs placeholder:text-muted-foreground transition-all hover:border-border hover:bg-background/60 focus-visible:border-primary/40 focus-visible:bg-background/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
