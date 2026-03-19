// Envoi d'email via Resend (https://resend.com — gratuit jusqu'à 3 000 emails/mois)
// Installer : npm install resend

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL     = process.env.FROM_EMAIL || 'CohabiConnect <admin@cohabiconnect.ci>'

/**
 * Envoie l'email de confirmation d'inscription à l'utilisateur.
 * @param {object} paiement  - ligne paiement depuis Supabase
 * @param {object} user      - ligne utilisateur depuis Supabase
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function sendConfirmationEmail(paiement, user) {
  if (!RESEND_API_KEY) {
    console.warn('[EMAIL] RESEND_API_KEY manquante — email non envoyé.')
    return { ok: false, error: 'RESEND_API_KEY manquante' }
  }

  const dateValidation = new Date(paiement.valide_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Confirmation CohabiConnect</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1D9E75,#0f6b52);padding:28px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">CohabiConnect</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;">Cohabitation Solidaire Étudiante · Bouaké</div>
          </td>
        </tr>

        <!-- Icône succès -->
        <tr>
          <td style="padding:28px 32px 0;text-align:center;">
            <div style="width:60px;height:60px;border-radius:50%;background:#F0FFF9;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 15L12 22L25 8" stroke="#1D9E75" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h1 style="font-size:22px;font-weight:700;color:#1a202c;margin:0 0 8px;">Inscription validée !</h1>
            <p style="font-size:14px;color:#64748b;margin:0;">Bonjour <strong>${user.prenom} ${user.nom}</strong>, votre compte CohabiConnect est désormais actif.</p>
          </td>
        </tr>

        <!-- Corps -->
        <tr>
          <td style="padding:24px 32px;">
            <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px;">
              Nous avons bien reçu et confirmé votre paiement de frais d'inscription.
              Vous pouvez maintenant accéder à toutes les fonctionnalités de la plateforme.
            </p>

            <!-- Récap paiement -->
            <div style="background:#F0FFF9;border:1px solid #b2e8d5;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
              <div style="font-size:11px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
                Récapitulatif du paiement
              </div>
              <table width="100%" style="font-size:13px;color:#374151;border-collapse:collapse;">
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">Référence</td>
                  <td style="text-align:right;font-weight:600;font-family:monospace;color:#1a202c;">${paiement.reference}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">Opérateur</td>
                  <td style="text-align:right;font-weight:600;color:#1a202c;">${paiement.operateur.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">Numéro</td>
                  <td style="text-align:right;color:#1a202c;">${paiement.numero_payeur}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">Montant</td>
                  <td style="text-align:right;font-weight:700;color:#1D9E75;">2 000 FCFA</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">Statut</td>
                  <td style="text-align:right;">
                    <span style="background:#052e1c;color:#34d399;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">✓ Validé</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">Date</td>
                  <td style="text-align:right;color:#1a202c;">${dateValidation}</td>
                </tr>
              </table>
            </div>

            <!-- Fonctionnalités disponibles -->
            <p style="font-size:13.5px;color:#374151;line-height:1.7;margin:0 0 16px;">
              Votre espace vous donne accès à :
            </p>
            <ul style="font-size:13.5px;color:#374151;line-height:1.9;margin:0 0 20px;padding-left:20px;">
              <li>🔍 Recherche et matching de colocataires compatibles</li>
              <li>🏠 Gestion et partage de logements</li>
              <li>💬 Système de médiation et signalement</li>
              <li>💰 Caisse commune et suivi des dépenses</li>
            </ul>

            <!-- CTA -->
            <div style="text-align:center;margin:24px 0;">
              <a href="${process.env.APP_URL || 'https://cohabiconnect.vercel.app'}"
                 style="display:inline-block;background:linear-gradient(135deg,#1D9E75,#0f6b52);color:#ffffff;padding:13px 32px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.01em;">
                Accéder à mon espace →
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="font-size:11.5px;color:#94a3b8;margin:0;line-height:1.6;text-align:center;">
              Cet email a été envoyé automatiquement par CohabiConnect.<br/>
              Pour toute question : <a href="mailto:support@cohabiconnect.ci" style="color:#1D9E75;">support@cohabiconnect.ci</a><br/>
              <span style="color:#cbd5e1;">Université Alassane Ouattara · Bouaké, Côte d'Ivoire</span>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [user.email],
        subject: `✓ Inscription validée — CohabiConnect (${paiement.reference})`,
        html
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[EMAIL] Resend error:', err)
      return { ok: false, error: err }
    }

    return { ok: true }
  } catch (err) {
    console.error('[EMAIL] Fetch error:', err)
    return { ok: false, error: err.message }
  }
}
