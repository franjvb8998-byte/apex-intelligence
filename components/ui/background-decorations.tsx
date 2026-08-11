export function BackgroundDecorations() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[#00D4AA]/10 blur-[120px]" />
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[#00D4AA]/5 blur-[100px]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#00D4AA 1px, transparent 1px), linear-gradient(90deg, #00D4AA 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
    </div>
  );
}
