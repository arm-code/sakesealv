import { ReaderPage } from "@/components/reader/reader-page";

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReaderPage bookId={Number(id)} />;
}
