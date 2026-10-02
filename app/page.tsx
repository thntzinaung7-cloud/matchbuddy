'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Profile, scoreMatch } from '@/lib/matching'

const split = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)
const MATCH_TYPES = ['study_buddy', 'mentor', 'roommate'] as const

type Request = {
  id: number
  from_user: string
  to_user: string
  status: string
  profiles: Profile
}

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [me, setMe] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', bio: '', match_type: 'study_buddy', interests: '', goals: '' })
  const [matches, setMatches] = useState<(Profile & { score: number })[]>([])
  const [view, setView] = useState<'matches' | 'requests'>('matches')
  const [incoming, setIncoming] = useState<Request[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) { setMe(null); setMatches([]); return }
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

  const loadIncoming = async () => {
    if (!userId) return
    const { data } = await supabase
      .from('match_requests')
      .select('id, from_user, to_user, status, profiles:from_user(*)')
      .eq('to_user', userId)
      .eq('status', 'pending')
    setIncoming((data as unknown as Request[]) ?? [])
  }

  useEffect(() => { if (view === 'requests') loadIncoming() }, [view, userId])

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

  const signOut = async () => { await supabase.auth.signOut() }

  const startEdit = () => {
    if (me) setForm({
      name: me.name, bio: me.bio ?? '', match_type: me.match_type,
      interests: me.interests.join(', '), goals: me.goals.join(', '),
    })
    setEditing(true)
  }

  const saveProfile = async () => {
    const row = {
      id: userId!, name: form.name, bio: form.bio,
      match_type: form.match_type,
      interests: split(form.interests), goals: split(form.goals),
    }
    const { error } = await supabase.from('profiles').upsert(row)
    if (error) { alert('Could not save profile: ' + error.message); return }
    setMe(row as Profile)
    setEditing(false)
  }

  const connect = async (toUser: string) => {
    const { error } = await supabase.from('match_requests').insert({ from_user: userId, to_user: toUser })
    if (error) { alert(error.code === '23505' ? 'You already sent a request.' : 'Error: ' + error.message); return }
    alert('Request sent!')
  }

  const respond = async (id: number, accept: boolean) => {
    if (accept) {
      await supabase.from('match_requests').update({ status: 'accepted' }).eq('id', id)
    } else {
      await supabase.from('match_requests').delete().eq('id', id)
    }
    loadIncoming()
  }

  if (!userId) return (
    <main className="max-w-md mx-auto p-8 space-y-3">
      <h1 className="text-2xl font-bold">MatchBuddy</h1>
      <input className="border p-2 w-full" placeholder="Your email"
        value={email} onChange={e => setEmail(e.target.value)} />
      <input className="border p-2 w-full" type="password" placeholder="Password (6+ characters)"
        value={password} onChange={e => setPassword(e.target.value)} />
      <div className="flex gap-2">
        <button className="bg-black text-white px-4 py-2 rounded" onClick={signIn}>Log in</button>
        <button className="border px-4 py-2 rounded" onClick={signUp}>Sign up</button>
      </div>
      {authError && <p className="text-red-500">{authError}</p>}
    </main>
  )

  if (!me || editing) return (
    <main className="max-w-md mx-auto p-8 space-y-3">
      <h1 className="text-2xl font-bold">{me ? 'Edit your profile' : 'Create your profile'}</h1>
      <input className="border p-2 w-full" placeholder="name"
        value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input className="border p-2 w-full" placeholder="bio"
        value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
      <select className="border p-2 w-full" value={form.match_type}
        onChange={e => setForm({ ...form, match_type: e.target.value })}>
        {MATCH_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
      </select>
      <input className="border p-2 w-full" placeholder="interests (comma separated)"
        value={form.interests} onChange={e => setForm({ ...form, interests: e.target.value })} />
      <input className="border p-2 w-full" placeholder="goals (comma separated)"
        value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })} />
      <div className="flex gap-2">
        <button className="bg-black text-white px-4 py-2 rounded" onClick={saveProfile}>Save</button>
        {me && <button className="border px-4 py-2 rounded" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </main>
  )

  return (
    <main className="max-w-xl mx-auto p-8 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Hi {me.name}</h1>
        <div className="flex gap-2">
          <button className="border px-3 py-1 rounded" onClick={startEdit}>Edit profile</button>
          <button className="border px-3 py-1 rounded" onClick={signOut}>Log out</button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <button className={`px-3 py-2 ${view === 'matches' ? 'border-b-2 border-black font-semibold' : ''}`}
          onClick={() => setView('matches')}>Matches</button>
        <button className={`px-3 py-2 ${view === 'requests' ? 'border-b-2 border-black font-semibold' : ''}`}
          onClick={() => setView('requests')}>Requests {incoming.length > 0 && `(${incoming.length})`}</button>
      </div>

      {view === 'matches' && (
        <div className="space-y-4">
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
        </div>
      )}

      {view === 'requests' && (
        <div className="space-y-4">
          {incoming.length === 0 && <p>No pending requests.</p>}
          {incoming.map(r => (
            <div key={r.id} className="border rounded p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{r.profiles.name}</p>
                <p className="text-sm text-gray-600">{r.profiles.interests.join(', ')}</p>
              </div>
              <div className="flex gap-2">
                <button className="bg-black text-white px-3 py-1 rounded" onClick={() => respond(r.id, true)}>Accept</button>
                <button className="border px-3 py-1 rounded" onClick={() => respond(r.id, false)}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}