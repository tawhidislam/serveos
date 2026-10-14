export default function SupportTypingIndicator({ ai = false, agent = false }: { ai?: boolean; agent?: boolean }) {
  if (!ai && !agent) return null;
  const label = agent ? 'Support team is typing…' : 'ServeOS AI is typing…';
  return <div role="status" aria-live="polite" aria-label={label} className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2">
    <span aria-hidden="true" className="flex items-center gap-1">{[0, 1, 2].map(index => <span key={index} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none" style={{ animationDelay: `${index * 120}ms` }} />)}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>;
}
