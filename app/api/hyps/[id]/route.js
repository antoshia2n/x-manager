import { createServerSupabaseClient } from '../../../../lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function PUT(req, { params }) {
  const db = createServerSupabaseClient()
  const { id } = await params
  const { id: _id, created_at, ...body } = await req.json()
  const { data, error } = await db.from('xm_hyps').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_, { params }) {
  const db = createServerSupabaseClient()
  const { id } = await params
  const { error } = await db.from('xm_hyps').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
