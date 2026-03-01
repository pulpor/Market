import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { confirmPasswordReset } from 'firebase/auth'
import { firebaseAuth, isFirebaseConfigured } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export default function ResetPassword() {
    const [password, setPassword] = useState('')
    const [oobCode, setOobCode] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const { toast } = useToast()

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('oobCode')
        setOobCode(code)
    }, [])

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (!isFirebaseConfigured || !firebaseAuth) {
                throw new Error('Firebase não configurado. Configure as variáveis VITE_FIREBASE_* no .env.')
            }
            if (!oobCode) {
                throw new Error('Link inválido ou expirado (código ausente). Solicite um novo link de recuperação.')
            }

            await confirmPasswordReset(firebaseAuth, oobCode, password)

            toast({
                title: "Senha atualizada",
                description: "Sua senha foi alterada com sucesso. Faça login novamente.",
            })

            navigate('/login')
        } catch (error: unknown) {
            toast({
                title: "Erro ao atualizar senha",
                description: error instanceof Error ? error.message : 'Não foi possível atualizar a senha.',
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold">Nova Senha</CardTitle>
                    <CardDescription>
                        Digite sua nova senha abaixo
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleReset} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Nova Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-9"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Atualizando...' : 'Atualizar Senha'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
