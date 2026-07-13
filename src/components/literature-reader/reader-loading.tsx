"use client";

export function ReaderLoading() {
  return (
    <div className="flex flex-col gap-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className="h-20 animate-pulse rounded-md bg-muted"
        />
      ))}
    </div>
  );
}
