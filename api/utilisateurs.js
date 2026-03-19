// GET  /api/utilisateurs?id=xxx
// GET  /api/utilisateurs?email=xxx
// Retourne le profil d'un utilisateur + son paiement

import { supabase } from '../../lib/supabase.js'

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY

function verifierAdmin(req) {
  return req.headers['x-admin-key'] === ADMIN_KEY
}

export default async function handler(req, res) {
  // Seul GET autorisé sans auth (profil public limité)
  // Pour les données complètes : admin uniquement
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { id, email } = req.query
  const isAdmin = verifierAdmin(req)

  if (!id && !email) {
    return res.status(400).json({ error: 'Paramètre id ou email requis.' })
  }

  try {
    let query = supabase
      .from('utilisateurs')
      .select(isAdmin
        ? '*, paiements(*)'
        : 'id, prenom, nom, etablissement, filiere, genre, role, statut, created_at'
      )

    if (id)    query = query.eq('id', id)
    if (email) query = query.eq('email', email)

    const { data, error } = await query.single()

    if (error || !data) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' })
    }

    return res.status(200).json({ utilisateur: data })

  } catch (err) {
    console.error('[UTILISATEURS GET]', err)
    return res.status(500).json({ error: 'Erreur serveur.' })
  }
}
