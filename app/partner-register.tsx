import PartnerScreenShell from '@/components/partner/PartnerScreenShell';

/** Inscription hôtel partenaire — placeholder navigation Lot 5 (formulaire Lot 6). */
export default function PartnerRegisterScreen() {
  return (
    <PartnerScreenShell
      title="Inscription hôtel partenaire"
      subtitle="Créez votre compte établissement PROTAXI — parcours métier au lot 6."
      showRegisterHint
      showDashboardLink
    />
  );
}
