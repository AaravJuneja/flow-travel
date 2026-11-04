import { createFileRoute, redirect } from '@tanstack/react-router'
import AuthForm from '../components/AuthForm'
import { getCurrentUser } from '../server/functions'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (await getCurrentUser()) throw redirect({ to: '/home' })
  },
  head: () => ({ meta: [{ title: 'Sign in to Flow' }] }),
  component: () => <AuthForm mode="signIn" />,
})
