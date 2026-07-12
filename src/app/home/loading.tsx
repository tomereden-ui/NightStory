// Route-level Suspense fallback — instant paint on nav, see library/loading.tsx.
export default function HomeLoading() {
  return (
    <div className="min-h-screen px-5 pt-6 pb-28 animate-pulse">
      <div className="h-8 w-52 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.06)" }} />
      <div className="h-44 rounded-3xl mb-8" style={{ background: "rgba(255,255,255,0.05)" }} />
      {[0, 1].map((rail) => (
        <div key={rail} className="mb-8">
          <div className="h-5 w-36 rounded mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-36 flex-shrink-0">
                <div className="aspect-square rounded-2xl mb-2" style={{ background: "rgba(255,255,255,0.05)" }} />
                <div className="h-3.5 w-3/4 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
