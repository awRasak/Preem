export default function AdminLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-40 rounded bg-surface-2" />
        <div className="h-24 rounded-xl bg-surface-2" />
        <div className="h-24 rounded-xl bg-surface-2" />
      </div>
    </main>
  );
}
