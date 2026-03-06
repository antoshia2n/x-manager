import { createServerSupabaseClient } from '../../../lib/supabaseServer'
import { NextResponse } from 'next/server'

// XManager flat format → DB format
function toDb(body) {
  const { id, date, sessions, focus_min, ...rest } = body
  return { date, sessions: sessions || 0, focus_min: focus_min || 0, counts: rest }
}
// DB format → XManager flat format
function fromDb(row) {
  return { id: row.id, date: row.date, sessions: row.sessions || 0, focus_min: row.focus_min || 0, ...(row.counts || {}) }
}

export async function GET() {
  const db = createServerSupabaseClient()
  const { data } = await db.from('xm_actions').select('*').order('date', { ascending: false })
  return NextResponse.json((data || []).map(fromDb))
}

export async function POST(req) {
  const db = createServerSupabaseClient()
  const body = await req.json()
  const { data, error } = await db.from('xm_actions')
    .upsert(toDb(body), { onConflict: 'date' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(fromDb(data))
}
