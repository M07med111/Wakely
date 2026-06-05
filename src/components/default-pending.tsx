export function DefaultPending() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-200/30 border-t-amber-400" />
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    </div>
  );
}
