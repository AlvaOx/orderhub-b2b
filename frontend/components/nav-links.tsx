'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  className: 'h-5 w-5',
  'aria-hidden': true,
} as const;

const LINKS = [
  {
    href: '/pedidos',
    label: 'Pedidos',
    icon: (
      <svg {...iconProps}>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/productos',
    label: 'Productos',
    icon: (
      <svg {...iconProps}>
        <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" strokeLinejoin="round" />
        <path d="m3 8 9 5 9-5M12 13v8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/usuarios',
    label: 'Usuarios',
    icon: (
      <svg {...iconProps}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 p-4">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {link.icon}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
