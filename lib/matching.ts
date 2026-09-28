export type Profile = {
  id: string
  name: string
  bio: string | null
  match_type: string
  interests: string[]
  goals: string[]
}

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a.map(s => s.toLowerCase()))
  const B = new Set(b.map(s => s.toLowerCase()))
  const shared = [...A].filter(x => B.has(x)).length
  const union = new Set([...A, ...B]).size
  return union === 0 ? 0 : shared / union
}

export function scoreMatch(a: Profile, b: Profile) {
  return Math.round(
    (0.6 * jaccard(a.interests, b.interests) +
     0.4 * jaccard(a.goals, b.goals)) * 100
  )
}