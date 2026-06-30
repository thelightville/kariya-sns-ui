export function Header({ title, eyebrow, children }: { title: string; eyebrow: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 border-b border-slate-200 pb-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-signal">{eyebrow}</p>
      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-ink">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Dedicated K-SNS operator UI for approved outputs, review queues, and connector visibility.
          </p>
        </div>
        {children}
      </div>
    </header>
  )
}
