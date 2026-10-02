/** The glossy blue sphere from the logo, on its own. */
export function LogoSphere({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 32% 28%, #e6fbff, #4DC5E5 45%, #1f7f9e)",
        boxShadow: "inset -2px -3px 6px rgba(0,50,70,0.35), 0 4px 10px -4px rgba(31,127,158,0.8)",
      }}
    />
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-2 font-['Schibsted_Grotesk'] text-lg font-bold tracking-tight">
      <LogoSphere />
      HireMind
    </span>
  );
}

/** The brand inside the nav pill on every page: the wordmark alone, no sphere. */
export function NavWordmark() {
  return <span className="pl-3 pr-1 font-['Schibsted_Grotesk'] text-lg font-bold tracking-tight">HireMind</span>;
}
