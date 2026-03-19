// POST /api/admin/valider
// Body: { paiementId, action: 'valider'|'rejeter', note? }
// Header: x-admin-key

import { supabase }              from '../../lib/supabase.js'
import { sendConfirmationEmail } from '../../lib/email.js'

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY

function verifierAdmin(req) {
  return req.headers['x-admin-key'] === ADMIN_KEY
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  if (!verifierAdmin(req)) {
    return res.status(401).json({ error: 'Accès non autorisé.' })
  }

  const { paiementId, action, note } = req.body

  if (!paiementId || !['valider', 'rejeter'].includes(action)) {
    return res.status(400).json({ error: 'paiementId et action (valider|rejeter) requis.' })
  }

  try {
    // 1. Récupérer le paiement + utilisateur
    const { data: paiement, error: fetchErr } = await supabase
      .from('paiements')
      .select('*, utilisateurs(*)')
      .eq('id', paiementId)
      .single()

    if (fetchErr || !paiement) {
      return res.status(404).json({ error: 'Paiement introuvable.' })
    }

    if (paiement.statut !== 'en_attente') {
      return res.status(409).json({ error: `Ce paiement est déjà ${paiement.statut}.` })
    }

    const user      = paiement.utilisateurs
    const now       = new Date().toISOString()
    const newStatut = action === 'valider' ? 'valide' : 'rejete'

    // 2. Mettre à jour le paiement
    const updatePayload = {
      statut:     newStatut,
      valide_par: 'siele-admin',
      note_admin: note || null,
      ...(action === 'valider'  ? { valide_at: now } : { rejete_at: now })
    }

    const { data: updated, error: updateErr } = await supabase
      .from('paiements')
      .update(updatePayload)
      .eq('id', paiementId)
      .select()
      .single()

    if (updateErr) throw updateErr

    // 3. Si validé → envoyer email de confirmation
    let emailResult = { ok: false, error: 'non tenté' }
    if (action === 'valider') {
      emailResult = await sendConfirmationEmail(updated, user)

      // Marquer email envoyé si succès
      if (emailResult.ok) {
        await supabase
          .from('paiements')
          .update({ email_envoye: true, email_envoye_at: new Date().toISOString() })
          .eq('id', paiementId)
      }
    }

    // 4. Si rejeté → notification de refus
    if (action === 'rejeter') {
      await supabase.from('notifications').insert([{
        utilisateur_id: user.id,
        type:    'paiement_rejete',
        titre:   'Paiement non confirmé',
        message: `Votre paiement (réf. ${paiement.reference}) n'a pas pu être confirmé. Contactez le support.`,
        metadata: { reference: paiement.reference, note: note || '' }
      }])
    }

    return res.status(200).json({
      message:      action === 'valider' ? 'Inscription validée avec succès.' : 'Paiement rejeté.',
      paiement:     updated,
      email_envoye: emailResult.ok,
      email_erreur: emailResult.error || null
    })

  } catch (err) {
    console.error('[ADMIN VALIDER]', err)
    return res.status(500).json({ error: 'Erreur serveur.' })
  }
}
