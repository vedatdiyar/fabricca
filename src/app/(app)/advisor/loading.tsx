import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading UI for the Advisor's Office workspace (/advisor).
 *
 * @returns The office loading skeleton markup.
 */
export default function AdvisorLoading() {
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64 rounded-md" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Skeleton className="lg:col-span-4 h-80 rounded-xl" />
        <Skeleton className="lg:col-span-8 h-96 rounded-xl" />
      </div>
    </div>
  );
}
