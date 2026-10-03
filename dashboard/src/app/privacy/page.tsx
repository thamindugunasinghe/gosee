import { LegalPage, P, H2, UL } from "../legal-ui";

export const metadata = { title: "Privacy Policy — GoSee" };

// NOTE: confirm the company legal name and contact email below before publishing.
const COMPANY = "WIWIS AI";
const CONTACT = "team@wiwisai.com";
const EFFECTIVE = "3 October 2026";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={EFFECTIVE}>
      <P>
        GoSee (&quot;the App&quot;, &quot;we&quot;, &quot;us&quot;) is operated by {COMPANY}. GoSee is a
        business tool that helps procurement teams schedule supplier site visits and coordinate
        engineers and suppliers. This policy explains what information we collect and how we use it.
      </P>

      <H2>Information we collect</H2>
      <UL
        items={[
          "Account details: your name and mobile phone number, provided by your organisation's Procurement team.",
          "Content you enter: job references, site locations, visit times, availability responses, and attendance records.",
          "Login information: we verify your identity using a one-time code (OTP) sent by SMS to your mobile number.",
          "Basic technical data needed to operate the app (for example, the time an action was taken).",
        ]}
      />

      <H2>How we use your information</H2>
      <UL
        items={[
          "To create and manage site-visit jobs and schedules.",
          "To send you notifications by SMS about visits assigned to you, invitations, confirmations and reminders.",
          "To show the right information to the right role (Procurement, Engineer, or Supplier).",
          "To keep the service secure and working correctly.",
        ]}
      />
      <P>We do not sell your personal information, and we do not use it for advertising.</P>

      <H2>Service providers</H2>
      <P>We share data only with the services needed to run GoSee:</P>
      <UL
        items={[
          "Supabase — secure database, authentication and hosting of application data.",
          "Text.lk — delivery of SMS notifications and login codes to your mobile number.",
        ]}
      />
      <P>
        These providers process data on our behalf and are not permitted to use it for their own
        purposes.
      </P>

      <H2>Data retention</H2>
      <P>
        We keep your information for as long as your account is active and as needed to provide the
        service. You may request deletion of your account and associated data by contacting us.
      </P>

      <H2>Security</H2>
      <P>
        Access is protected by one-time SMS codes and role-based permissions. Data is transmitted over
        encrypted connections. No method of transmission or storage is completely secure, but we take
        reasonable steps to protect your information.
      </P>

      <H2>Your rights</H2>
      <P>
        You can ask us to access, correct, or delete your personal information. To do so, contact us
        using the details below.
      </P>

      <H2>Children</H2>
      <P>GoSee is a workplace tool and is not directed to children under 13.</P>

      <H2>Changes to this policy</H2>
      <P>
        We may update this policy from time to time. We will revise the date at the top when we do.
      </P>

      <H2>Contact us</H2>
      <P>
        Questions about this policy or your data? Email us at{" "}
        <a href={`mailto:${CONTACT}`} style={{ color: "#1e5fd8" }}>{CONTACT}</a>.
      </P>
    </LegalPage>
  );
}
