import { createFileRoute, redirect } from '@tanstack/react-router'
import AuthForm from '../components/AuthForm'
import { getCurrentUser } from '../server/functions'

export const Route = createFileRoute('/signup')({
  beforeLoad: async () => {
    if (await getCurrentUser()) throw redirect({ to: '/home' })
  },
  head: () => ({ meta: [{ title: 'Create your Flow account' }] }),
  component: () => <AuthForm mode="create" />,
})
