'use client'

import Link from 'next/link'

const navItems = [
  { icon: 'home', label: '', href: '/home' },
  { icon: 'search', label: '', href: '/search' },
  { icon: 'notifications', label: '', href: '/notifications' },
  { icon: 'mail', label: '', href: '/messages' },
]

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 w-full h-16 bg-black/90 backdrop-blur-md border-t border-border flex items-center justify-around z-50">
      {navItems.map((item) => (
        <Link
          key={item.icon}
          href={item.href}
          className="text-text-primary flex flex-col items-center gap-1 p-2 hover:bg-surface-elevated rounded-full transition-colors"
        >
          <span className="material-symbols-outlined">{item.icon}</span>
        </Link>
      ))}
      <Link href="/profile/arivera_tech">
        <div className="w-7 h-7 rounded-full overflow-hidden border border-border hover:border-primary transition-colors">
          <img
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCAiB3pQA4P_SlBS7NVKe89vq9cBJ3Y-SeTalEgEME6v5KZCWHIkh15yBDoc4ncZ9vzd2CtA2A20E7e3A0KHG_YbhJNbYxOkzBucn5-nUZbQgUDc1l6jbBRJBxJYggeML98UvUl2dh_xlG1ZBw8t5cjEj3Y1n07Fu0dkdvluegKdiO6XuflaY5AIwAlD7oFP-2LORaTkWYgJMVAmBkvSXU8PZZadu-TpOY4vevLUC4YzwVYaHNnJlsDqwAAggMgOkr36MPI8cKDbco"
            alt="Profile"
          />
        </div>
      </Link>
    </nav>
  )
}