export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { createServerSupabaseClient } from '../lib/supabaseServer'
import XManager from '../components/XManager'

export default async function Page() {
  const db = createServerSupabaseClient()

  const [
    { data: rawActions },
    { data: posts },
    { data: analytics },
    { data: reviews },
    { data: rules },
    { data: hyps },
    { data: tmpls },
    { data: settingsRow },
  ] = await Promise.all([
    db.from('xm_actions').select('*').order('date', { ascending: false }),
    db.from('xm_posts').select('*').order('date', { ascending: false }),
    db.from('xm_analytics').select('*').order('date', { ascending: false }),
    db.from('xm_reviews').select('*'),
    db.from('xm_rules').select('*').order('id', { ascending: false }),
    db.from('xm_hyps').select('*').order('id', { ascending: false }),
    db.from('xm_tmpls').select('*').order('id', { ascending: false }),
    db.from('xm_settings').select('*').eq('id', 1).single(),
  ])

  const actions = (rawActions || []).map(a => ({
    id: a.id, date: a.date,
    sessions: a.sessions || 0, focus_min: a.focus_min || 0,
    ...(a.counts || {}),
  }))

  const settings = settingsRow ? {
    soundEnabled:   settingsRow.sound_enabled,
    resetHour:      settingsRow.reset_hour,
    sessionTarget:  settingsRow.session_target,
    postLabels:     settingsRow.post_labels,
    ruleCategories: settingsRow.rule_categories,
  } : null

  return (
    <XManager initialData={{
      actions,
      posts:         (posts   || []).map(p => ({ ...p, labels: p.labels || [] })),
      analytics:     analytics || [],
      weeklyReviews: reviews   || [],
      rules:         (rules   || []).map(r => ({ ...r, labels: r.labels || [] })),
      hyps:          hyps     || [],
      tmpls:         (tmpls   || []).map(t => ({ ...t, tags: t.tags || [] })),
      settings,
      actionItems:   settingsRow?.action_items || null,
      kpiItems:      settingsRow?.kpi_items    || null,
    }} />
  )
}
