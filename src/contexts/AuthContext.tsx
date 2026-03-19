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

function getAuthErrorCode(err: unknown): string {
  if (!err || typeof err !== 'object') return ''
  if ('code' in err) {
    const maybeCode = (err as { code?: unknown }).code
    if (typeof maybeCode === 'string') return maybeCode
  }
  return ''
}

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const maybeMsg = (err as { message?: unknown }).message
    if (typeof maybeMsg === 'string') return maybeMsg
  }
  return ''
}

function isLikelyProjectMismatch(): boolean {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN

  if (!projectId || !authDomain) return false

  // Para domínios padrão do Firebase, o início costuma refletir o projectId.
  if (authDomain.endsWith('.firebaseapp.com') && !authDomain.startsWith(`${projectId}.`)) {
    return true
  }

  return false
}

function mapFirebaseAuthError(err: unknown, action: 'login' | 'signup' | 'google' | 'session'): string {
  const code = getAuthErrorCode(err)
  const rawMessage = getErrorMessage(err)

  const fallbackByAction: Record<typeof action, string> = {
    login: 'Nao foi possivel fazer login.',
    signup: 'Nao foi possivel criar a conta.',
    google: 'Nao foi possivel fazer login com Google.',
    session: 'Falha ao validar sessao de autenticacao.',
  }

  switch (code) {
    case 'auth/invalid-credential':
      if (action === 'google') {
        return 'Credencial invalida para login Google. Verifique se o provider Google esta habilitado no Firebase e se o dominio atual esta autorizado.'
      }
      return 'Email ou senha invalidos, ou as variaveis VITE_FIREBASE_* apontam para projeto Firebase diferente.'
    case 'auth/invalid-api-key':
      return 'API key do Firebase invalida. Revise VITE_FIREBASE_API_KEY na Vercel/.env e faca novo deploy.'
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'API key do Firebase invalida. Revise VITE_FIREBASE_API_KEY na Vercel/.env e faca novo deploy.'
    case 'auth/unauthorized-domain':
      return 'Dominio nao autorizado no Firebase Auth. Adicione o dominio atual em Authentication > Settings > Authorized domains.'
    case 'auth/operation-not-allowed':
      if (action === 'google') {
        return 'Login com Google desabilitado no Firebase. Ative em Authentication > Sign-in method > Google.'
      }
      if (action === 'login') {
        return 'Login por Email/Senha desabilitado no Firebase. Ative em Authentication > Sign-in method > Email/Password.'
      }
      return 'Metodo de autenticacao desabilitado no Firebase para esta operacao.'
    case 'auth/user-disabled':
      return 'Este usuario foi desativado no Firebase Auth.'
    case 'auth/network-request-failed':
      return 'Falha de rede ao falar com Firebase Auth. Verifique internet, VPN, proxy ou bloqueio no navegador.'
    case 'auth/popup-blocked':
      return 'Popup bloqueado pelo navegador. Permita popups ou tente novamente.'
    case 'auth/popup-closed-by-user':
      return 'Popup de login foi fechado antes de concluir autenticacao.'
    case 'auth/account-exists-with-different-credential':
      return 'Ja existe conta com este email usando outro metodo de login.'
    default:
      return rawMessage || fallbackByAction[action]
  }
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

    if (isLikelyProjectMismatch()) {
      console.warn(
        '[AuthContext] Possivel mismatch de projeto Firebase:',
        'VITE_FIREBASE_PROJECT_ID=',
        import.meta.env.VITE_FIREBASE_PROJECT_ID,
        'VITE_FIREBASE_AUTH_DOMAIN=',
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      )
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
          console.log('[AuthContext] Setando user (via redirectResult):', redirectUser.email)
          setUser({ id: redirectUser.uid, email: redirectUser.email })
          setLoading(false)
          console.log('[AuthContext] User setado e loading=false')
          toast({
            title: 'Login realizado',
            description: 'Bem-vindo de volta!',
          })
        } else {
          console.log('[AuthContext] getRedirectResult retornou null, aguardando onAuthStateChanged')
          // Fallback: se redirectResult for null, tenta pegar currentUser imediatamente
          const currentUser = firebaseAuth.currentUser
          if (currentUser) {
            console.log('[AuthContext] Fallback: currentUser existe:', currentUser.email)
            setUser({ id: currentUser.uid, email: currentUser.email })
            setLoading(false)
            toast({
              title: 'Login realizado',
              description: 'Bem-vindo de volta!',
            })
          }
        }
      } catch (err: unknown) {
        const msg = mapFirebaseAuthError(err, 'session')
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
        console.log('[AuthContext] onAuthStateChanged disparado. User:', fbUser?.email || 'null')
        if (fbUser) {
          console.log('[AuthContext] Setando user via listener:', fbUser.email)
          setUser({ id: fbUser.uid, email: fbUser.email })
        } else {
          console.log('[AuthContext] Listener: user=null')
          setUser(null)
        }
        setLoading(false)
      },
      (err) => {
        const msg = mapFirebaseAuthError(err, 'session')
        console.error('[AuthContext] onAuthStateChanged error:', err)
        toast({
          title: 'Erro no estado de autenticação',
          description: msg,
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
      const msg = mapFirebaseAuthError(err, 'login')
      toast({
        title: 'Erro ao fazer login',
        description: msg,
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
      const rawMsg = getErrorMessage(err)
      const description = rawMsg.includes('auth/email-already-in-use')
        ? 'Este email já está cadastrado. Tente fazer login ou recuperar sua senha.'
        : mapFirebaseAuthError(err, 'signup')

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
      provider.setCustomParameters({ prompt: 'select_account' })
      console.log('[AuthContext] signInWithGoogle iniciado')

      // Tenta popup primeiro em qualquer ambiente (melhor UX e evita alguns
      // problemas de redirect em browsers com bloqueios extras).
      try {
        console.log('[AuthContext] Tentando signInWithPopup... hostname:', window.location.hostname)
        await signInWithPopup(firebaseAuth, provider)
        console.log('[AuthContext] signInWithPopup sucesso')
      } catch (err: unknown) {
        const code = getAuthErrorCode(err)
        const msg = getErrorMessage(err)
        console.warn('[AuthContext] signInWithPopup falhou:', msg, 'caindo pro redirect...')
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/operation-not-supported-in-this-environment' ||
          code === 'auth/web-storage-unsupported'
        ) {
          console.log('[AuthContext] Fallback: chamando signInWithRedirect...')
          await signInWithRedirect(firebaseAuth, provider)
          return
        }

        if (code === 'auth/unauthorized-domain') {
          throw new Error(
            `Dominio atual (${window.location.hostname}) nao autorizado no Firebase Auth. Adicione este dominio em Authentication > Settings > Authorized domains ou use o dominio principal da Vercel.`,
          )
        }

        throw err
      }
    } catch (err: unknown) {
      const msg = mapFirebaseAuthError(err, 'google')
      console.error('[AuthContext] signInWithGoogle erro final:', err)
      toast({
        title: 'Erro ao fazer login com Google',
        description: msg,
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
