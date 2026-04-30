import { login, signup } from './actions'
import { Activity } from 'lucide-react'

export default async function LoginPage(props: { searchParams: Promise<{ message: string }> }) {
  const searchParams = await props.searchParams
  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto mt-20 relative z-10">
      <div className="flex justify-center mb-8">
        <div className="h-16 w-16 bg-primary/20 text-primary rounded-2xl flex items-center justify-center border border-primary/30 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
          <Activity size={32} />
        </div>
      </div>
      
      <div className="glass-card p-8 animate-in fade-in zoom-in duration-500">
        <h2 className="text-2xl font-semibold mb-2 text-center text-foreground">Bienvenido</h2>
        <p className="text-muted-foreground text-center mb-8 text-sm">Inicia sesión en tu dashboard de DDL Fotografía</p>

        <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground">
          <label className="text-sm font-medium" htmlFor="email">
            Correo Electrónico
          </label>
          <input
            className="rounded-md px-4 py-3 bg-secondary/50 border border-border mb-4 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-muted-foreground"
            name="email"
            placeholder="tu@correo.com"
            required
          />
          <label className="text-sm font-medium" htmlFor="password">
            Contraseña
          </label>
          <input
            className="rounded-md px-4 py-3 bg-secondary/50 border border-border mb-6 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-muted-foreground"
            type="password"
            name="password"
            placeholder="••••••••"
            required
          />
          <button
            formAction={login}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md px-4 py-3 font-medium transition-all shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
          >
            Iniciar Sesión
          </button>
          <button
            formAction={signup}
            className="bg-transparent border border-border hover:bg-secondary text-foreground rounded-md px-4 py-3 font-medium transition-all mt-2 active:scale-[0.98]"
          >
            Crear Cuenta
          </button>
          {searchParams?.message && (
            <p className="mt-4 p-4 bg-destructive/10 text-destructive text-center rounded-md border border-destructive/20 text-sm">
              {searchParams.message === 'Could not authenticate user' ? 'No se pudo autenticar al usuario' : searchParams.message}
            </p>
          )}
        </form>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full -z-10 pointer-events-none opacity-50 mix-blend-screen" />
    </div>
  )
}
