// POST /api/signalement  — créer un signalement
// GET  /api/signalement?utilisateurId=xxx — voir les signalements d'un user
// PATCH /api/signalement — mettre à jour le statut (admin)

import { supabase } from '../../lib/supabase.js'

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY

function verifierAdmin(req) {
  return req.headers['x-admin-key'] === ADMIN_KEY
}

export default async function handler(req, res) {

  // ── GET : liste des signalements
  if (req.method === 'GET') {
    const { utilisateurId } = req.query

    try {
      let query = supabase
        .from('signalements')
        .select('*, auteur:auteur_id(prenom, nom, email), cible:cible_id(prenom, nom)')
        .order('created_at', { ascending: false })

      if (utilisateurId) {
        query = query.or(`auteur_id.eq.${utilisateurId},cible_id.eq.${utilisateurId}`)
      }

      const { data, error } = await query
      if (error) throw error

      return res.status(200).json({ signalements: data })

    } catch (err) {
      console.error('[SIGNALEMENT GET]', err)
      return res.status(500).json({ error: 'Erreur serveur.' })
    }
  }

  // ── POST : créer un signalement
  if (req.method === 'POST') {
    const { auteurId, cibleId, typeProbleme, description, urgence } = req.body

    if (!auteurId || !typeProbleme) {
      return res.status(400).json({ error: 'auteurId et typeProbleme requis.' })
    }

    try {
      const { data, error } = await supabase
        .from('signalements')
        .insert([{
          auteur_id:     auteurId,
          cible_id:      cibleId || null,
          type_probleme: typeProbleme,
          description:   description || null,
          urgence:       urgence || 'normale'
        }])
        .select()
        .single()

      if (error) throw error

      return res.status(201).json({
        message:      'Signalement enregistré. Notre équipe vous contactera.',
        signalement:  data
      })

    } catch (err) {
      console.error('[SIGNALEMENT POST]', err)
      return res.status(500).json({ error: 'Erreur serveur.' })
    }
  }

  // ── PATCH : mettre à jour statut (admin seulement)
  if (req.method === 'PATCH') {
    if (!verifierAdmin(req)) {
      return res.status(401).json({ error: 'Accès non autorisé.' })
    }

    const { signalementId, statut } = req.body

    if (!signalementId || !['en_cours', 'cloture'].includes(statut)) {
      return res.status(400).json({ error: 'signalementId et statut valide requis.' })
    }

    try {
      const updateData = {
        statut,
        ...(statut === 'cloture' ? { resolu_at: new Date().toISOString() } : {})
      }

      const { data, error } = await supabase
        .from('signalements')
        .update(updateData)
        .eq('id', signalementId)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({ message: 'Signalement mis à jour.', signalement: data })

    } catch (err) {
      console.error('[SIGNALEMENT PATCH]', err)
      return res.status(500).json({ error: 'Erreur serveur.' })
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' })
}
