import { createServerSupabaseClient } from '../../../lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function GET() {
  const db = createServerSupabaseClient()
  const { data } = await db.from('xm_rules').select('*').order('id', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req) {
  const db = createServerSupabaseClient()
  const { id, created_at, ...body } = await req.json()
  const { data, error } = await db.from('xm_rules').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
