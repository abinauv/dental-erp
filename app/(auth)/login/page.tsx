'use client'

import { useState, Suspense } from 'react'
import { signIn, oidcEnabled, signInWithOidc } from '@/lib/auth-client'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const t = useTranslations('auth.login')
  const tCommon = useTranslations('common')
  const [isLoading, setIsLoading] = useState(false)
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)

    try {
      const { error } = await signIn.email({
        email: data.email,
        password: data.password,
      })

      if (error) {
        toast({
          variant: 'destructive',
          title: t('loginFailed'),
          description: t('invalidCredentials'),
        })
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: tCommon('states.error'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
            D
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">{t('heading')}</CardTitle>
        <CardDescription>{t('subheading')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t('passwordPlaceholder')}
              {...register('password')}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('submit')}
          </Button>
        </form>

        {oidcEnabled && (
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading}
              onClick={() => signInWithOidc(callbackUrl)}
            >
              {t('ssoButton')}
            </Button>
          </div>
        )}

        <div className="mt-6 text-center text-sm">
          <p className="text-muted-foreground">
            {t('noAccount')}{' '}
            <a href="/signup" className="text-primary hover:underline">
              {t('signUp')}
            </a>
          </p>
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground border-t pt-4">
          <p>{t('demoCredentials')}</p>
          <p className="font-mono mt-1">admin@demo-dental.com / Admin@123</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  const t = useTranslations('auth.login')
  return (
    <Suspense
      fallback={
        <Card className="shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
                D
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">{t('heading')}</CardTitle>
            <CardDescription>{t('loading')}</CardDescription>
          </CardHeader>
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
