import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast({
        title: 'Erro ao fazer login',
        description: error.message,
        variant: 'destructive',
      })
      throw error
    }

    toast({
      title: 'Login realizado',
      description: 'Bem-vindo de volta!',
    })
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      toast({
        title: 'Erro ao criar conta',
        description: error.message,
        variant: 'destructive',
      })
      throw error
    }

    toast({
      title: 'Conta criada',
      description: 'Verifique seu email para confirmar o cadastro.',
    })
  }

  const signOut = async () => {
    // Evita erro quando não há sessão ativa e força escopo local.
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!currentSession) {
        setUser(null)
        setSession(null)
        return
      }

      // Tenta uma saída "local" (não global). Se o backend recusar (403), seguimos limpando localmente.
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) {
        // Suaviza 403/AuthSessionMissing: limpa estado local mesmo assim.
        console.warn('SignOut retornou erro, limpando sessão local mesmo assim:', error?.message)
      }
    } catch (err: any) {
      // Suaviza AuthSessionMissingError e outros
      console.warn('SignOut falhou, prosseguindo com limpeza local:', err?.message)
    } finally {
      // Limpeza local forçada do estado e possível token no storage
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
        if (url) {
          const projectRef = new URL(url).host.split('.')[0]
          const possibleKeys = [
            `sb-${projectRef}-auth-token`,
            `sb-${projectRef}-auth-token.local`,
          ]
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) || ''
            if (possibleKeys.some(pk => k.startsWith(pk))) {
              try { localStorage.removeItem(k) } catch {}
            }
          }
        }
      } catch {}

      setUser(null)
      setSession(null)

      toast({
        title: 'Logout realizado',
        description: 'Sessão encerrada localmente.',
      })
    }
  }

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      toast({
        title: 'Erro ao fazer login com Google',
        description: error.message,
        variant: 'destructive',
      })
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
