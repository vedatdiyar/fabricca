import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading UI for the Advisor's Office workspace (/advisor).
 *
 * @returns The office loading skeleton markup.
 */
export default function AdvisorLoading() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100dvh-9.5rem)] lg:min-h-[460px]">
        <Skeleton className="lg:col-span-4 h-full rounded-lg" />
        <Skeleton className="lg:col-span-8 h-full rounded-lg" />
      </div>
    </div>
  );
}
