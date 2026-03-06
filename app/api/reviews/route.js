import { createServerSupabaseClient } from '../../../lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function GET() {
  const db = createServerSupabaseClient()
  const { data } = await db.from('xm_reviews').select('*')
  return NextResponse.json(data || [])
}

export async function POST(req) {
  const db = createServerSupabaseClient()
  const { id, ...body } = await req.json()
  const { data, error } = await db.from('xm_reviews')
    .upsert(body, { onConflict: 'week_start' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
