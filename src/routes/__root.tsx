import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Flow | Travel in good flow',
      },
      {
        name: 'description',
        content: 'Plan a smoother journey with Flow by Velo AI.',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/assets/flow-mark.svg',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  errorComponent: RootError,
})

function RootError() {
  return (
    <main className="route-error">
      <section>
        <img src="/assets/flow-mark-header.svg" alt="Flow" />
        <h1>This page couldn’t load</h1>
        <p>Reload the page to try again.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload page</button>
        <a href="/home">Back to my trips</a>
      </section>
    </main>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
