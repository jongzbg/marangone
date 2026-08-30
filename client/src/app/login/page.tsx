'use client'

import { useState } from 'react'
import { authApi } from '@/lib/api'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const res = await authApi.login(email, password)
        console.log('[Login] login success, token:', res.data.token?.slice(0, 20) + '...')
        localStorage.setItem('token', res.data.token)
        window.location.href = '/home'
      } else {
        await authApi.register(email, password, username, displayName)
        const res = await authApi.login(email, password)
        console.log('[Login] register+login success, token:', res.data.token?.slice(0, 20) + '...')
        localStorage.setItem('token', res.data.token)
        window.location.href = '/home'
      }
    } catch (err: any) {
      console.error('[Login] error:', err?.response?.status, err?.response?.data || err?.message)
      setError(err.response?.data?.message || err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#004a78] rounded-full blur-[96px]" />
      </div>

      {/* Login Card */}
      <section className="relative z-10 w-full max-w-[400px] mx-4">
        <div className="bg-black border border-border rounded-2xl p-8 flex flex-col items-center">
          {/* Logo & Title */}
          <div className="mb-8 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-primary text-5xl">terminal</span>
            <h1 className="text-display-lg text-text-primary mt-4">Join Nexus.</h1>
            <p className="text-body-sm text-text-muted">Real-time tech-literate intelligence.</p>
          </div>

          {/* Form */}
          <form className="w-full space-y-4" onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div className="space-y-1">
                  <label className="text-label-caps text-text-muted px-1">USERNAME</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
                    placeholder="username"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-label-caps text-text-muted px-1">DISPLAY NAME</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
                    placeholder="Display Name"
                    required
                  />
                </div>
              </>
            )}
            <div className="space-y-1">
              <label htmlFor="email" className="text-label-caps text-text-muted px-1">EMAIL ADDRESS</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
                placeholder="name@nexus.tech"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="text-label-caps text-text-muted px-1">PASSWORD</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
                placeholder="••••••••"
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:opacity-90 active:scale-[0.98] transition-all text-white font-bold py-3 px-6 rounded-full mt-2 disabled:opacity-50"
            >
              {loading ? 'Loading...' : isLogin ? 'Log In' : 'Sign Up'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center w-full my-6">
            <div className="flex-grow h-[1px] bg-border" />
            <span className="px-3 text-label-caps text-text-muted">OR</span>
            <div className="flex-grow h-[1px] bg-border" />
          </div>

          {/* Social buttons */}
          <div className="w-full space-y-4">
            <button className="w-full bg-white text-black font-bold py-3 px-6 rounded-full flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
              <img
                alt="Google"
                className="w-5 h-5"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCMODoEo_W493pHFVTVYunB4PUQGUNI2AYMwqyCZRlqjnnD1VMrQQpQusBWtdZDzyVAyfrILsPuBtBg0KO1YINO1bTvRy6Vd4myPwzxCchMfJ08-qsWUrFTsgEFzNikmlH221yg00da1Ne6HJmeumZdyIpBn5-2mbZXzPKXu350ZxydpUwiAHqcddTTL2gmwbqWjIB9933DE5Fnse0yfDmQzntG9ov2axqmAlP7Bejd-qZVNOILRUf0bk92yuMAmtsI1hUgajDOa-A"
              />
              Sign up with Google
            </button>
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="w-full bg-black border border-border text-white font-bold py-3 px-6 rounded-full hover:bg-surface-elevated transition-colors"
            >
              {isLogin ? 'Create New Account' : 'Already have an account? Log In'}
            </button>

            {isLogin && (
              <a className="text-center text-body-sm text-text-muted hover:text-primary hover:underline transition-colors" href="#">
                Forgot Password?
              </a>
            )}
          </div>

          <p className="mt-8 text-center text-body-sm text-text-muted">
            By signing up, you agree to the{' '}
            <a className="text-primary hover:underline" href="#">Terms of Service</a> and{' '}
            <a className="text-primary hover:underline" href="#">Privacy Policy</a>.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="absolute bottom-0 w-full bg-black border-t border-border py-8 px-4">
        <div className="max-w-screen-xl mx-auto flex flex-wrap justify-center gap-x-6 gap-y-2">
          <a className="text-body-sm text-text-muted hover:text-primary" href="#">About</a>
          <a className="text-body-sm text-text-muted hover:text-primary" href="#">Help Center</a>
          <a className="text-body-sm text-text-muted hover:text-primary" href="#">Terms of Service</a>
          <a className="text-body-sm text-text-muted hover:text-primary" href="#">Privacy Policy</a>
          <a className="text-body-sm text-text-muted hover:text-primary" href="#">Cookie Policy</a>
          <a className="text-body-sm text-text-muted hover:text-primary" href="#">Accessibility</a>
          <a className="text-body-sm text-text-muted hover:text-primary" href="#">Ads info</a>
          <a className="text-body-sm text-text-muted hover:text-primary" href="#">Blog</a>
          <a className="text-body-sm text-text-muted hover:text-primary" href="#">Careers</a>
          <span className="text-body-sm text-text-muted">© 2024 Nexus Corp.</span>
        </div>
      </footer>
    </main>
  )
}
