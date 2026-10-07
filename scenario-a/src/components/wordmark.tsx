export function Wordmark({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid size-8 place-items-center rounded-md font-serif text-[15px] font-semibold tracking-tight ${
          inverted ? "text-navy bg-white" : "bg-navy text-white"
        }`}
        aria-hidden
      >
        B
      </span>
      <span className="flex flex-col leading-none">
        <span className={`font-serif text-[17px] font-medium ${inverted ? "text-white" : "text-ink"}`}>
          Portfolio Pulse
        </span>
        <span
          className={`mt-1 text-[10px] font-semibold tracking-[0.18em] uppercase ${
            inverted ? "text-white/55" : "text-faint"
          }`}
        >
          BNH · Office of the CoS
        </span>
      </span>
    </div>
  );
}
