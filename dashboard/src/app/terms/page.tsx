import { LegalPage, P, H2, UL } from "../legal-ui";

export const metadata = { title: "Terms of Use — GoSee" };

const COMPANY = "WIWIS (Pvt) Ltd";
const CONTACT = "transfleet.primecare@gmail.com";
const EFFECTIVE = "3 October 2026";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated={EFFECTIVE}>
      <P>
        These terms govern your use of GoSee (&quot;the App&quot;), operated by {COMPANY}. By using the
        App you agree to these terms.
      </P>

      <H2>Who can use GoSee</H2>
      <P>
        GoSee is a business tool for authorised users only. Accounts are created by a customer&apos;s
        Procurement team. You may use the App only with an account provided to you and only for its
        intended business purpose.
      </P>

      <H2>Your responsibilities</H2>
      <UL
        items={[
          "Keep your access to your mobile number and device secure.",
          "Provide accurate information when scheduling, responding to, or closing visits.",
          "Use the App lawfully and do not attempt to disrupt or misuse the service.",
        ]}
      />

      <H2>Notifications</H2>
      <P>
        The App sends operational SMS notifications (for example, visit invitations, confirmations and
        reminders) to the mobile number on your account. Standard carrier charges from your mobile
        provider may apply.
      </P>

      <H2>Availability</H2>
      <P>
        We aim to keep GoSee available and reliable, but the service is provided &quot;as is&quot; without
        warranties. We may update, suspend, or discontinue features at any time.
      </P>

      <H2>Limitation of liability</H2>
      <P>
        To the extent permitted by law, {COMPANY} is not liable for indirect or consequential losses
        arising from your use of, or inability to use, the App.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about these terms? Email{" "}
        <a href={`mailto:${CONTACT}`} style={{ color: "#1e5fd8" }}>{CONTACT}</a>.
      </P>
    </LegalPage>
  );
}
