export default function RootLoading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground font-sans">Yükleniyor...</p>
      </div>
    </div>
  );
}
