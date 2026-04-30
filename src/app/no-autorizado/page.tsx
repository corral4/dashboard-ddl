import { ShieldX } from 'lucide-react'
import Link from 'next/link'
import { signout } from '@/app/login/actions'

export default function NoAutorizado() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <ShieldX size={40} className="text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Acceso no autorizado</h1>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Tu cuenta no tiene permisos para acceder a este dashboard. 
          Contacta al administrador si crees que esto es un error.
        </p>
        <form action={signout}>
          <button className="w-full py-3 px-6 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium transition-colors">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
