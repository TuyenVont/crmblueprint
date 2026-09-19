import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being logged out randomly.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isProtectedRoute =
    pathname.startsWith('/app') || pathname.startsWith('/onboarding')
  const isAuthRoute = pathname === '/login' || pathname === '/register'

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle()

    if (isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = !member ? '/onboarding/workspace' : '/app/dashboard'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/onboarding')) {
      if (member) {
        const url = request.nextUrl.clone()
        url.pathname = '/app/dashboard'
        return NextResponse.redirect(url)
      }
    }

    if (pathname.startsWith('/app')) {
      if (!member) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding/workspace'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
