// GET /api/admin/paiements?statut=en_attente&page=1&limit=20
// Retourne la liste des paiements avec les infos utilisateur
// Protégé par clé admin dans le header: x-admin-key

import { supabase } from '../../lib/supabase.js'

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY

function verifierAdmin(req) {
  const key = req.headers['x-admin-key']
  return key && key === ADMIN_KEY
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  if (!verifierAdmin(req)) {
    return res.status(401).json({ error: 'Accès non autorisé.' })
  }

  const { statut = 'en_attente', page = 1, limit = 20, search = '' } = req.query
  const offset = (parseInt(page) - 1) * parseInt(limit)

  try {
    let query = supabase
      .from('paiements')
      .select(`
        *,
        utilisateurs (
          id, prenom, nom, email, telephone,
          etablissement, filiere, genre, role, statut
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1)

    if (statut !== 'tous') {
      query = query.eq('statut', statut)
    }

    if (search) {
      query = query.or(`reference.ilike.%${search}%,utilisateurs.nom.ilike.%${search}%,utilisateurs.email.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) throw error

    // Statistiques globales
    const { data: stats } = await supabase
      .from('paiements')
      .select('statut')

    const statsResume = {
      en_attente: stats?.filter(p => p.statut === 'en_attente').length || 0,
      valide:     stats?.filter(p => p.statut === 'valide').length     || 0,
      rejete:     stats?.filter(p => p.statut === 'rejete').length     || 0,
      recettes:  (stats?.filter(p => p.statut === 'valide').length || 0) * 2000
    }

    return res.status(200).json({
      paiements: data,
      total: count,
      page: parseInt(page),
      stats: statsResume
    })

  } catch (err) {
    console.error('[ADMIN PAIEMENTS]', err)
    return res.status(500).json({ error: 'Erreur serveur.' })
  }
}
