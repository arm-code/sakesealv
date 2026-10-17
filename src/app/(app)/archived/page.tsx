import { Suspense } from "react";
import { ArchivedView } from "@/components/library/archived-view";

export default function ArchivedPage() {
  return (
    <Suspense fallback={null}>
      <ArchivedView />
    </Suspense>
  );
}
