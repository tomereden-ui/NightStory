// Route-level Suspense fallback — instant paint on nav, see library/loading.tsx.
export default function ProfileLoading() {
  return (
    <div className="min-h-screen px-5 pt-6 pb-28 animate-pulse">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div>
          <div className="h-5 w-36 rounded mb-2" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="h-3.5 w-24 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl mb-3" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.05)" }} />
      ))}
    </div>
  );
}
