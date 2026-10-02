export default function Logo() {
  return (
    <span className="flex items-center gap-2 font-['Schibsted_Grotesk'] text-lg font-bold tracking-tight">
      <span
        aria-hidden="true"
        className="h-6 w-6 rounded-full"
        style={{
          background: "radial-gradient(circle at 32% 28%, #e6fbff, #4DC5E5 45%, #1f7f9e)",
          boxShadow: "inset -2px -3px 6px rgba(0,50,70,0.35), 0 4px 10px -4px rgba(31,127,158,0.8)",
        }}
      />
      HireMind
    </span>
  );
}
