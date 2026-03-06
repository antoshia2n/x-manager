import { createServerSupabaseClient } from '../../../../lib/supabaseServer'
import { NextResponse } from 'next/server'

function toDb(body) {
  const { id, date, sessions, focus_min, ...rest } = body
  return { date, sessions: sessions || 0, focus_min: focus_min || 0, counts: rest }
}
function fromDb(row) {
  return { id: row.id, date: row.date, sessions: row.sessions || 0, focus_min: row.focus_min || 0, ...(row.counts || {}) }
}

export async function PUT(req, { params }) {
  const db = createServerSupabaseClient()
  const { id } = await params
  const body = await req.json()
  const { data, error } = await db.from('xm_actions').update(toDb(body)).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(fromDb(data))
}

export async function DELETE(_, { params }) {
  const db = createServerSupabaseClient()
  const { id } = await params
  const { error } = await db.from('xm_actions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
