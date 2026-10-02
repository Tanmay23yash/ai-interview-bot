/** The HireMind wordmark (no sphere): the footer, and inside the nav pill on every page. */
export default function Logo() {
  return <span className="font-['Schibsted_Grotesk'] text-lg font-bold tracking-tight">HireMind</span>;
}

/** The wordmark with the inset it needs inside the nav pill. */
export function NavWordmark() {
  return (
    <span className="pl-3 pr-1">
      <Logo />
    </span>
  );
}
