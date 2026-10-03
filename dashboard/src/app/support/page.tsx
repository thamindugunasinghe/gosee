import { LegalPage, P, H2, UL } from "../legal-ui";

export const metadata = { title: "Support — GoSee" };

const CONTACT = "transfleet.primecare@gmail.com";

export default function SupportPage() {
  return (
    <LegalPage title="Support">
      <P>
        Need help with GoSee? We are happy to assist. GoSee helps procurement teams schedule supplier
        site visits and keep engineers and suppliers informed automatically.
      </P>

      <H2>Contact us</H2>
      <P>
        Email:{" "}
        <a href={`mailto:${CONTACT}`} style={{ color: "#1e5fd8" }}>{CONTACT}</a>
        <br />
        We usually reply within one business day.
      </P>

      <H2>Common questions</H2>
      <UL
        items={[
          "I can't log in: make sure you are using the mobile number registered by your Procurement team. You will receive a one-time code by SMS.",
          "I'm not getting SMS codes: check your signal and that the number is correct, then try 'Resend code'.",
          "I don't see my job: pull down to refresh the list.",
          "Wrong details on a job: contact your Procurement team to update it.",
        ]}
      />

      <H2>Accounts</H2>
      <P>
        GoSee accounts are managed by your organisation&apos;s Procurement team. To be added or removed,
        please contact them, or email us using the address above.
      </P>
    </LegalPage>
  );
}
