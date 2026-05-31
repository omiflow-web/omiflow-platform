'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // If it's an auth error, redirect to login
    if (
      error.message?.includes('Refresh Token') ||
      error.message?.includes('Invalid token') ||
      error.message?.includes('JWT') ||
      error.message?.includes('session')
    ) {
      router.push('/auth/login')
    }
  }, [error, router])

  const isAuthError =
    error.message?.includes('Refresh Token') ||
    error.message?.includes('Invalid token') ||
    error.message?.includes('session')

  if (isAuthError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-sm">Session expired — redirecting to login...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-600 text-xl">!</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-6">
          An unexpected error occurred. Try refreshing the page.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-omiflow-600 text-white text-sm font-medium rounded-lg hover:bg-omiflow-700 transition-colors">
            Try again
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Go to dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
