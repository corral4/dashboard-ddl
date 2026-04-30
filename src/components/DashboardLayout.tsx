import { LayoutDashboard, CreditCard, PieChart, LogOut, Bell, Wallet } from 'lucide-react'
import { signout } from '@/app/login/actions'
import Link from 'next/link'
import Image from 'next/image'

export default function DashboardLayout({ children, userEmail, activePage = 'resumen' }: { children: React.ReactNode, userEmail: string, activePage?: string }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-background"></span>
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-blue-500 border-2 border-background shadow-md"></div>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

function NavItem({ href, icon, label, active = false }: { href: string, icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <Link href={href} className={`flex items-center w-full px-4 py-3 rounded-md transition-all ${
      active 
        ? 'bg-primary/10 text-primary font-medium' 
        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
    }`}>
      <span className="mr-3">{icon}</span>
      {label}
    </Link>
  )
}
