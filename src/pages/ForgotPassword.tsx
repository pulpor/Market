import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { firebaseAuth, isFirebaseConfigured } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

function getErrorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code?: unknown }).code
        if (typeof code === 'string') return code
    }
    return ''
}

function mapResetError(error: unknown): string {
    const code = getErrorCode(error)
    const message = error instanceof Error ? error.message : ''

    switch (code) {
        case 'auth/invalid-email':
            return 'Email invalido. Confira o endereco informado.'
        case 'auth/user-not-found':
            return 'Nao encontramos conta com este email.'
        case 'auth/too-many-requests':
            return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
        case 'auth/network-request-failed':
            return 'Falha de rede ao enviar email de recuperacao.'
        default:
            return message || 'Ocorreu um erro ao tentar enviar o email.'
    }
}

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (!isFirebaseConfigured || !firebaseAuth) {
                throw new Error('Firebase não configurado. Configure as variáveis VITE_FIREBASE_* no .env.')
            }

            // Usa o fluxo hospedado do proprio Firebase, que evita falhas por
            // dominio/continueUrl em ambientes de deploy (Vercel preview/prod).
            await sendPasswordResetEmail(firebaseAuth, email)

            setSubmitted(true)
            toast({
                title: "Email enviado",
                description: "Verifique sua caixa de entrada para redefinir a senha.",
            })
        } catch (error: unknown) {
            toast({
                title: "Erro ao enviar email",
                description: mapResetError(error),
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Verifique seu email</CardTitle>
                        <CardDescription>
                            Enviamos um link de recuperação para <strong>{email}</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-center">
                        <Button variant="ghost" asChild>
                            <Link to="/login" className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" /> Voltar para o login
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold">Recuperar Senha</CardTitle>
                    <CardDescription>
                        Digite seu email para receber um link de redefinição
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-9"
                                    required
                                />
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar link'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button variant="link" asChild className="text-muted-foreground">
                        <Link to="/login" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Voltar para o login
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
