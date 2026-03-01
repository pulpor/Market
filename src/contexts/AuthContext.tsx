import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth'
import { firebaseAuth, isFirebaseConfigured, missingFirebaseEnvKeys } from '@/lib/firebase'
import { toast } from '@/hooks/use-toast'

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const maybeMsg = (err as { message?: unknown }).message
    if (typeof maybeMsg === 'string') return maybeMsg
  }
  return ''
}

export type AuthUser = {
  id: string
  email?: string | null
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      setLoading(false)
      return
    }

    // Completa fluxo de redirect (Google login). Em alguns ambientes,
    // o redirectResult chega antes do onAuthStateChanged estabilizar.
    ;(async () => {
      try {
        console.log('[AuthContext] Iniciando getRedirectResult...')
        const result = await getRedirectResult(firebaseAuth)
        const redirectUser = result?.user
        console.log('[AuthContext] getRedirectResult concluído. User:', redirectUser?.email || 'null')
        if (redirectUser) {
          console.log('[AuthContext] Setando user:', redirectUser.email)
          setUser({ id: redirectUser.uid, email: redirectUser.email })
          setLoading(false)
          console.log('[AuthContext] User setado e loading=false')
          toast({
            title: 'Login realizado',
            description: 'Bem-vindo de volta!',
          })
        } else {
          console.log('[AuthContext] getRedirectResult retornou null, aguardando onAuthStateChanged')
        }
      } catch (err: unknown) {
        const msg = getErrorMessage(err)
        console.error('[AuthContext] Erro em getRedirectResult:', err, 'msg:', msg)
        if (msg) {
          toast({
            title: 'Erro ao concluir login',
            description: msg,
            variant: 'destructive',
          })
        }
      }
    })()

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (fbUser) => {
        if (fbUser) {
          setUser({ id: fbUser.uid, email: fbUser.email })
        } else {
          setUser(null)
        }
        setLoading(false)
      },
      (err) => {
        const msg = getErrorMessage(err)
        console.error('onAuthStateChanged error:', err)
        toast({
          title: 'Erro no estado de autenticação',
          description: msg || 'Falha ao acompanhar sessão do Firebase Auth.',
          variant: 'destructive',
        })
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      toast({
        title: "Configuração necessária",
        description: "Configure as chaves do Firebase no arquivo .env para fazer login.",
        variant: "destructive"
      });
      return;
    }

    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      toast({
        title: 'Erro ao fazer login',
        description: msg || 'Não foi possível fazer login.',
        variant: 'destructive',
      })
      throw err
    }

    toast({
      title: 'Login realizado',
      description: 'Bem-vindo de volta!',
    })
  }

  const signUp = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      toast({
        title: "Configuração necessária",
        description: "Configure as chaves do Firebase no arquivo .env para criar conta.",
        variant: "destructive"
      })
      return
    }

    try {
      await createUserWithEmailAndPassword(firebaseAuth, email, password)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      const description = msg.includes('auth/email-already-in-use')
        ? 'Este email já está cadastrado. Tente fazer login ou recuperar sua senha.'
        : (msg || 'Não foi possível criar a conta.')

      toast({
        title: 'Erro ao criar conta',
        description,
        variant: 'destructive',
      })
      throw err
    }

    toast({
      title: 'Conta criada',
      description: 'Conta criada com sucesso.',
    })
  }

  const signOut = async () => {
    if (!firebaseAuth) {
      setUser(null)
      return
    }

    try {
      await firebaseSignOut(firebaseAuth)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      console.warn('SignOut falhou, limpando estado local mesmo assim:', msg)
    } finally {
      setUser(null)
      toast({
        title: 'Logout realizado',
        description: 'Sessão encerrada.',
      })
    }
  }

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      const missing = missingFirebaseEnvKeys.length
        ? `Faltando: ${missingFirebaseEnvKeys.join(', ')}`
        : 'Variáveis VITE_FIREBASE_* ausentes.'

      toast({
        title: "Modo Local",
        description:
          `Firebase não configurado neste build. ${missing} Configure na Vercel (Settings → Environment Variables) e faça um Redeploy.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const provider = new GoogleAuthProvider()

      // Popups frequentemente falham em produção por políticas COOP/terceiros.
      // Então, no site online, use sempre Redirect (mais confiável).
      const isLocalDev =
        import.meta.env.DEV &&
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

      if (!isLocalDev) {
        await signInWithRedirect(firebaseAuth, provider)
        return
      }

      // Em localhost, popup é mais confortável; se falhar, cai pro redirect.
      try {
        await signInWithPopup(firebaseAuth, provider)
      } catch (err: unknown) {
        const msg = getErrorMessage(err)
        if (
          msg.includes('auth/popup-blocked') ||
          msg.includes('auth/popup-closed-by-user') ||
          msg.includes('auth/cancelled-popup-request') ||
          msg.includes('auth/operation-not-supported-in-this-environment')
        ) {
          await signInWithRedirect(firebaseAuth, provider)
          return
        }
        throw err
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      toast({
        title: 'Erro ao fazer login com Google',
        description: msg || 'Não foi possível fazer login com Google.',
        variant: 'destructive',
      })
      throw err
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
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
