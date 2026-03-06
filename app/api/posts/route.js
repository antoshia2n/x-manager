import { createServerSupabaseClient } from '../../../lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function GET() {
  const db = createServerSupabaseClient()
  const { data } = await db.from('xm_posts').select('*').order('date', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req) {
  const db = createServerSupabaseClient()
  const { id, ...body } = await req.json()  // strip temp id
  const { data, error } = await db.from('xm_posts').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
