'use client'

import { useState } from 'react'
import { LayoutDashboard, CreditCard, PieChart, LogOut, Bell, Wallet, Menu, X } from 'lucide-react'
import { signout } from '@/app/login/actions'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

export default function DashboardLayout({ children, userEmail, activePage = 'resumen' }: { children: React.ReactNode, userEmail: string, activePage?: string }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar — unchanged */}
      <aside className="w-64 border-r border-border bg-card/30 backdrop-blur-md hidden md:flex flex-col">
        <div className="h-20 flex items-center px-5 border-b border-border gap-3">
          <Image src="/logo.png" alt="Logo" width={40} height={40} className="rounded-lg flex-shrink-0" />
          <span className="font-bold text-sm tracking-tight leading-tight">Diente de León<br/>Fotografía Infantil</span>
        </div>
        
        <div className="flex-1 py-6 px-4 flex flex-col gap-2">
          <NavItem href="/" icon={<LayoutDashboard size={20} />} label="Resumen" active={activePage === 'resumen'} />
          <NavItem href="/gastos" icon={<Wallet size={20} />} label="Gastos y Rentabilidad" active={activePage === 'gastos'} />
          <NavItem href="/sesiones" icon={<CreditCard size={20} />} label="Sesiones" active={activePage === 'sesiones'} />
          <NavItem href="/analisis" icon={<PieChart size={20} />} label="Análisis IA" active={activePage === 'analisis'} />
        </div>
        
        <div className="p-4 border-t border-border">
          <div className="bg-secondary/50 rounded-lg p-4 mb-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Sesión iniciada como</p>
            <p className="text-sm font-medium truncate">{userEmail}</p>
          </div>
          <form action={signout}>
            <button className="flex w-full items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-4 py-2 rounded-md transition-colors text-sm font-medium">
              <LogOut size={18} className="mr-3" />
              Cerrar Sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-card border-r border-border z-50 flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header with close button */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-border">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={36} height={36} className="rounded-lg flex-shrink-0" />
            <span className="font-bold text-sm tracking-tight leading-tight">Diente de León<br/>Fotografía Infantil</span>
          </div>
          <button
            onClick={closeMobileMenu}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-6 px-4 flex flex-col gap-2">
          <NavItem href="/" icon={<LayoutDashboard size={20} />} label="Resumen" active={activePage === 'resumen'} onClick={closeMobileMenu} />
          <NavItem href="/gastos" icon={<Wallet size={20} />} label="Gastos y Rentabilidad" active={activePage === 'gastos'} onClick={closeMobileMenu} />
          <NavItem href="/sesiones" icon={<CreditCard size={20} />} label="Sesiones" active={activePage === 'sesiones'} onClick={closeMobileMenu} />
          <NavItem href="/analisis" icon={<PieChart size={20} />} label="Análisis IA" active={activePage === 'analisis'} onClick={closeMobileMenu} />
        </div>

        {/* User info & logout */}
        <div className="p-4 border-t border-border">
          <div className="bg-secondary/50 rounded-lg p-4 mb-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Sesión iniciada como</p>
            <p className="text-sm font-medium truncate">{userEmail}</p>
          </div>
          <form action={signout}>
            <button
              onClick={closeMobileMenu}
              className="flex w-full items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-4 py-2 rounded-md transition-colors text-sm font-medium"
            >
              <LogOut size={18} className="mr-3" />
              Cerrar Sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            {/* Hamburger — visible only on mobile */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors md:hidden"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-xl font-semibold">Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-background"></span>
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-blue-500 border-2 border-background shadow-md"></div>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

function NavItem({ href, icon, label, active = false, onClick }: { href: string, icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className={`flex items-center w-full px-4 py-3 rounded-md transition-all ${
      active 
        ? 'bg-primary/10 text-primary font-medium' 
        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
    }`}>
      <span className="mr-3">{icon}</span>
      {label}
    </Link>
  )
}
