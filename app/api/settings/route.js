import { createServerSupabaseClient } from '../../../lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function GET() {
  const db = createServerSupabaseClient()
  const { data } = await db.from('xm_settings').select('*').eq('id', 1).single()
  return NextResponse.json(data)
}

export async function PUT(req) {
  const db = createServerSupabaseClient()
  const body = await req.json()
  const { data, error } = await db.from('xm_settings').upsert({
    id: 1,
    sound_enabled:    body.soundEnabled   ?? body.sound_enabled,
    reset_hour:       body.resetHour      ?? body.reset_hour,
    session_target:   body.sessionTarget  ?? body.session_target,
    post_labels:      body.postLabels     ?? body.post_labels,
    rule_categories:  body.ruleCategories ?? body.rule_categories,
    action_items:     body.actionItems    ?? body.action_items,
    kpi_items:        body.kpiItems       ?? body.kpi_items,
  }, { onConflict: 'id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
