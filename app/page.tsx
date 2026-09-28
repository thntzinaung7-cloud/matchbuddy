'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Profile, scoreMatch } from '@/lib/matching'

const split = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [me, setMe] = useState<Profile | null>(null)
  const [form, setForm] = useState({ name: '', bio: '', interests: '', goals: '' })
  const [matches, setMatches] = useState<(Profile & { score: number })[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) {
      setMe(null)
      setMatches([])
      return
    }
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      .then(({ data }) => setMe(data))
  }, [userId])

  useEffect(() => {
    if (!me) return
    supabase.from('profiles').select('*')
      .eq('match_type', me.match_type).neq('id', me.id)
      .then(({ data }) => {
        const ranked = (data ?? [])
          .map(p => ({ ...p, score: scoreMatch(me, p) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
        setMatches(ranked)
      })
  }, [me])

  const signUp = async () => {
    setAuthError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setAuthError(error.message)
  }

  const signIn = async () => {
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const saveProfile = async () => {
    const row = {
      id: userId!, name: form.name, bio: form.bio,
      match_type: 'study_buddy',
      interests: split(form.interests), goals: split(form.goals),
    }
    const { error } = await supabase.from('profiles').upsert(row)
    if (error) {
      alert('Could not save profile: ' + error.message)
      return
    }
    setMe(row as Profile)
  }

  const connect = async (toUser: string) => {
    const { error } = await supabase.from('match_requests')
      .insert({ from_user: userId, to_user: toUser })
    if (error) {
      alert(error.code === '23505' ? 'You already sent a request.' : 'Error: ' + error.message)
      return
    }
    alert('Request sent!')
  }

  if (!userId) return (
    <main className="max-w-md mx-auto p-8 space-y-3">
      <h1 className="text-2xl font-bold">MatchBuddy</h1>
      <input className="border p-2 w-full" placeholder="Your email"
        value={email} onChange={e => setEmail(e.target.value)} />
      <input className="border p-2 w-full" type="password"
        placeholder="Password (6+ characters)"
        value={password} onChange={e => setPassword(e.target.value)} />
      <div className="flex gap-2">
        <button className="bg-black text-white px-4 py-2 rounded" onClick={signIn}>
          Log in
        </button>
        <button className="border px-4 py-2 rounded" onClick={signUp}>
          Sign up
        </button>
      </div>
      {authError && <p className="text-red-500">{authError}</p>}
    </main>
  )

  if (!me) return (
    <main className="max-w-md mx-auto p-8 space-y-3">
      <h1 className="text-2xl font-bold">Create your profile</h1>
      {(['name', 'bio', 'interests', 'goals'] as const).map(k => (
        <input key={k} className="border p-2 w-full"
          placeholder={k === 'interests' || k === 'goals' ? `${k} (comma separated)` : k}
          value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
      ))}
      <button className="bg-black text-white px-4 py-2 rounded" onClick={saveProfile}>
        Save
      </button>
    </main>
  )

  return (
    <main className="max-w-xl mx-auto p-8 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Hi {me.name}, your top matches</h1>
        <button className="border px-3 py-1 rounded" onClick={signOut}>Log out</button>
      </div>
      {matches.length === 0 && <p>No one else has joined yet. Invite a friend!</p>}
      {matches.map(m => (
        <div key={m.id} className="border rounded p-4 flex justify-between items-center">
          <div>
            <p className="font-semibold">{m.name} · {m.score}% match</p>
            <p className="text-sm text-gray-600">{m.interests.join(', ')}</p>
          </div>
          <button className="bg-black text-white px-3 py-1 rounded" onClick={() => connect(m.id)}>
            Connect
          </button>
        </div>
      ))}
    </main>
  )
}