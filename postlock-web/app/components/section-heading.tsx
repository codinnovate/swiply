export function SectionHeading({
  eyebrow,
  title,
  lastUpdated,
}: {
  eyebrow?: string;
  title: string;
  lastUpdated?: string;
}) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {lastUpdated ? (
        <p className="mt-2 text-sm text-muted">Last updated: {lastUpdated}</p>
      ) : null}
    </div>
  );
}
