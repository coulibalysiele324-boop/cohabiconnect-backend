// GET   /api/notifications?utilisateurId=xxx  — liste des notifs
// PATCH /api/notifications                    — marquer comme lues

import { supabase } from '../../lib/supabase.js'

export default async function handler(req, res) {

  // ── GET : récupérer les notifications
  if (req.method === 'GET') {
    const { utilisateurId, nonLues } = req.query

    if (!utilisateurId) {
      return res.status(400).json({ error: 'utilisateurId requis.' })
    }

    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('utilisateur_id', utilisateurId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (nonLues === 'true') {
        query = query.eq('lu', false)
      }

      const { data, error } = await query
      if (error) throw error

      const nonLuesCount = data.filter(n => !n.lu).length

      return res.status(200).json({
        notifications: data,
        non_lues:      nonLuesCount
      })

    } catch (err) {
      console.error('[NOTIFICATIONS GET]', err)
      return res.status(500).json({ error: 'Erreur serveur.' })
    }
  }

  // ── PATCH : marquer une ou toutes les notifs comme lues
  if (req.method === 'PATCH') {
    const { utilisateurId, notificationId } = req.body

    if (!utilisateurId) {
      return res.status(400).json({ error: 'utilisateurId requis.' })
    }

    try {
      let query = supabase
        .from('notifications')
        .update({ lu: true })
        .eq('utilisateur_id', utilisateurId)

      if (notificationId) {
        query = query.eq('id', notificationId)
      }

      const { error } = await query
      if (error) throw error

      return res.status(200).json({ message: 'Notifications marquées comme lues.' })

    } catch (err) {
      console.error('[NOTIFICATIONS PATCH]', err)
      return res.status(500).json({ error: 'Erreur serveur.' })
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' })
}
