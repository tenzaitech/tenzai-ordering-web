import { redirect } from 'next/navigation'

/**
 * Catch-all route for /liff/*
 *
 * PROBLEM: LIFF sometimes opens URLs like:
 *   /liff/order/status/<id>
 * instead of:
 *   /liff?liff.state=/order/status/<id>
 *
 * This catch-all captures those paths and redirects to the proper
 * /liff entry point with liff.state query parameter.
 */

interface PageProps {
  params: Promise<{ path: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function LiffCatchAllPage({ params, searchParams }: PageProps) {
  const { path } = await params
  const query = await searchParams

  // Reconstruct target path from segments
  // Example: ["order", "status", "abc-123"] => "/order/status/abc-123"
  const target = '/' + path.join('/')

  // Validate: only allow internal /order/* paths (same rule as /liff page)
  const isValidTarget = target.startsWith('/order/') && target.length > 7

  // If invalid target, redirect to default menu
  if (!isValidTarget) {
    redirect('/liff')
  }

  // Build redirect URL with liff.state
  const redirectUrl = new URL('/liff', 'http://localhost')
  redirectUrl.searchParams.set('liff.state', target)

  // Preserve other query params (e.g., debug=1) but avoid duplicating liff.state
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'liff.state' && typeof value === 'string') {
      redirectUrl.searchParams.set(key, value)
    }
  }

  // Redirect to /liff with proper query params
  // Use pathname + search to get relative URL
  redirect(redirectUrl.pathname + redirectUrl.search)
}
