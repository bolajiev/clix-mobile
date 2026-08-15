import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join the Beta',
  description:
    'Sign up as a beta tester for Clix Mobile on Google Play. Help us test, find bugs, and shape the product before public launch.',
  alternates: { canonical: 'https://clix.bolajiev.com/beta' },
  openGraph: {
    title: 'Join the Clix Mobile Beta',
    description:
      'Get early access to Clix Mobile on Google Play. We need 20 testers to unlock the public release.',
    url: 'https://clix.bolajiev.com/beta',
  },
}

export default function BetaLayout({ children }: { children: React.ReactNode }) {
  return children
}
