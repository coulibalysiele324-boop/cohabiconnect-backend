// POST /api/inscription
// Crée un utilisateur + paiement en attente
// Body: { prenom, nom, email, telephone, whatsapp, etablissement, filiere, genre, role, operateur, numeroPaiement, reference }

import { supabase } from '../../lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const {
    prenom, nom, email, telephone, whatsapp,
    etablissement, filiere, genre, role,
    operateur, numeroPaiement, reference, preferences
  } = req.body

  // Validation basique
  if (!prenom || !nom || !email || !telephone || !etablissement || !role || !operateur || !numeroPaiement || !reference) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' })
  }

  if (!['chercheur', 'proprietaire'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide.' })
  }

  if (!['wave', 'mtn', 'orange', 'moov'].includes(operateur)) {
    return res.status(400).json({ error: 'Opérateur invalide.' })
  }

  try {
    // 1. Vérifier si email déjà utilisé
    const { data: existing } = await supabase
      .from('utilisateurs')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà enregistré.' })
    }

    // 2. Vérifier si référence déjà utilisée
    const { data: existingRef } = await supabase
      .from('paiements')
      .select('id')
      .eq('reference', reference)
      .single()

    if (existingRef) {
      return res.status(409).json({ error: 'Cette référence de paiement est déjà enregistrée.' })
    }

    // 3. Créer l'utilisateur
    const { data: user, error: userErr } = await supabase
      .from('utilisateurs')
      .insert([{ prenom, nom, email, telephone, whatsapp, etablissement, filiere, genre, role, preferences: preferences || {} }])
      .select()
      .single()

    if (userErr) throw userErr

    // 4. Créer le paiement
    const { data: paiement, error: payErr } = await supabase
      .from('paiements')
      .insert([{
        utilisateur_id: user.id,
        reference,
        operateur,
        numero_payeur: numeroPaiement,
        montant: 2000,
        statut: 'en_attente'
      }])
      .select()
      .single()

    if (payErr) throw payErr

    return res.status(201).json({
      message: 'Inscription enregistrée. En attente de validation admin.',
      utilisateur_id: user.id,
      paiement_id: paiement.id,
      reference: paiement.reference
    })

  } catch (err) {
    console.error('[INSCRIPTION]', err)
    return res.status(500).json({ error: 'Erreur serveur. Réessayez plus tard.' })
  }
}
