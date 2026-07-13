// Route-level Suspense fallback — instant paint on nav, see library/loading.tsx.
export default function StudioLoading() {
  return (
    <div className="min-h-screen px-5 pt-6 pb-28 animate-pulse">
      <div className="h-8 w-44 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.06)" }} />
      <div className="h-56 rounded-3xl mb-6" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="flex gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-14 h-14 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
        ))}
      </div>
      <div className="h-14 rounded-2xl" style={{ background: "rgba(255,255,255,0.045)" }} />
    </div>
  );
}
