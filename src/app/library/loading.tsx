// Route-level Suspense fallback — lets the nav transition commit and paint
// instantly (this was the "frozen for seconds with no feedback" tab switch:
// with no loading boundary anywhere, router.push had nothing to show until
// the whole page chunk compiled/loaded and rendered).
export default function LibraryLoading() {
  return (
    <div className="min-h-screen px-5 pt-6 pb-28 animate-pulse">
      <div className="h-8 w-40 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.06)" }} />
      <div className="flex gap-2 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 w-24 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="aspect-square" style={{ background: "rgba(255,255,255,0.05)" }} />
            <div className="p-3">
              <div className="h-4 w-3/4 rounded mb-2" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div className="h-3 w-1/2 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
