import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Skeleton loading UI for the authentication group routes.
 *
 * @returns The login-shaped centered skeleton.
 */
export default function AuthRouteLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md space-y-5 rounded-md p-8">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-40" />
          <Skeleton className="mx-auto h-3 w-60 max-w-full bg-border/20" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 bg-border/20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 bg-border/20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </Card>
    </div>
  );
}
