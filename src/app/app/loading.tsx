export default function WorkspaceLoading() {
  return (
    <div
      role="status"
      aria-label="טוען את סביבת העבודה"
      className="workspace animate-pulse"
    >
      <div className="mb-8 h-9 w-52 rounded-xl bg-slate-200" />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-white" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-2xl bg-white" />
        <div className="h-80 rounded-2xl bg-white" />
      </div>
      <span className="sr-only">טוען…</span>
    </div>
  );
}
