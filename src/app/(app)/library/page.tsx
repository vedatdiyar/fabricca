import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUsersMatrixAndBoxes } from "@/app/(app)/_services/box-service";
import { LibraryContent } from "./_components/library-content";

/**
 * Library page — fetches the thesis matrix and box hierarchy,
 * then renders the interactive library content component.
 */
export default async function LibraryPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const boxResult = await getUsersMatrixAndBoxes(session.userId);

  if ("error" in boxResult) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">
          Henüz bir tez matrisi oluşturulmamış.
        </p>
      </div>
    );
  }

  // Only parent boxes (parentId = null) are passed; sub-boxes are resolved
  // inside LiteratureReader.
  const { parentBoxes: boxes } = boxResult.data;

  return <LibraryContent boxes={boxes} />;
}
