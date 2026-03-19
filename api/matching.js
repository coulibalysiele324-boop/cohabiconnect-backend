// GET /api/matching?utilisateurId=xxx
// Retourne les meilleurs matchs pour un utilisateur
// Algorithme basé sur : établissement, filière, genre, préférences

import { supabase } from '../../lib/supabase.js'

/**
 * Calcule un score de compatibilité entre deux utilisateurs (0-100)
 */
function calculerScore(u1, u2) {
  let score = 0

  // Même établissement (+30)
  if (u1.etablissement === u2.etablissement) score += 30

  // Même genre si préférence (+20)
  if (u1.genre === u2.genre) score += 20

  // Préférences de vie similaires (+50 réparti)
  const prefs1 = u1.preferences || {}
  const prefs2 = u2.preferences || {}

  const criteres = ['horaire', 'fumeur', 'animaux', 'proprete', 'bruit']
  const parCritere = 10

  for (const critere of criteres) {
    if (prefs1[critere] && prefs2[critere] && prefs1[critere] === prefs2[critere]) {
      score += parCritere
    }
  }

  return Math.min(score, 100)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { utilisateurId } = req.query

  if (!utilisateurId) {
    return res.status(400).json({ error: 'utilisateurId requis.' })
  }

  try {
    // Récupérer l'utilisateur demandeur
    const { data: moi, error: errMoi } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('id', utilisateurId)
      .eq('statut', 'actif')
      .single()

    if (errMoi || !moi) {
      return res.status(404).json({ error: 'Utilisateur actif introuvable.' })
    }

    // Récupérer tous les autres utilisateurs actifs avec le même rôle (chercheur)
    const { data: candidats, error: errCandidats } = await supabase
      .from('utilisateurs')
      .select('id, prenom, nom, etablissement, filiere, genre, role, preferences, created_at')
      .eq('statut', 'actif')
      .eq('role', 'chercheur')
      .neq('id', utilisateurId)
      .limit(100)

    if (errCandidats) throw errCandidats

    // Récupérer les matchings déjà traités pour cet utilisateur
    const { data: dejaTraites } = await supabase
      .from('matchings')
      .select('cible_id, statut')
      .eq('demandeur_id', utilisateurId)

    const dejaTraitesMap = {}
    for (const m of (dejaTraites || [])) {
      dejaTraitesMap[m.cible_id] = m.statut
    }

    // Calculer et trier les scores
    const matchs = candidats
      .map(candidat => ({
        utilisateur: {
          id:            candidat.id,
          prenom:        candidat.prenom,
          nom:           candidat.nom,
          etablissement: candidat.etablissement,
          filiere:       candidat.filiere,
          genre:         candidat.genre,
          inscrit_le:    candidat.created_at
        },
        score:   calculerScore(moi, candidat),
        statut:  dejaTraitesMap[candidat.id] || 'nouveau'
      }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)

    return res.status(200).json({
      matchs,
      total: matchs.length
    })

  } catch (err) {
    console.error('[MATCHING]', err)
    return res.status(500).json({ error: 'Erreur serveur.' })
  }
}
