export default function LibraryLoading() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground font-sans">Kütüphane yükleniyor...</p>
      </div>
    </div>
  );
}
