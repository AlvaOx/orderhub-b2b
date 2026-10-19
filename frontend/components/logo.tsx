export function Logo() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M21 8 12 3 3 8l9 5 9-5Z" strokeLinejoin="round" />
        <path d="m3 13 9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m3 17.5 9 5 9-5" strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      </svg>
    </span>
  );
}
