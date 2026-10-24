export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    book: <><path d="M4 4h13a2 2 0 0 1 2 2v15H6a2 2 0 0 1-2-2V4Z"/><path d="M4 17h15M8 8h7M8 11h5"/></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></>,
    chart: <><path d="M4 4v16h16M7 15c3 0 3-8 6-8s3 6 7 2"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    down: <><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/></>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5M5 16v4h14v-4"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.2 9a2.8 2.8 0 0 1 5.6 0c0 2-2.8 2-2.8 4M12 16h.01"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    keyboard: <><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    chevron: <path d="m9 5 7 7-7 7"/>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    minus: <path d="M5 12h14"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.book}</svg>;
}
