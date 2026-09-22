import { PolicyPage } from "@/components/policy-page";

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Dantown Electrical privacy"
      title="Your information, handled with care."
      intro="This notice explains how Dantown Electrical uses information needed to serve customers, process orders, and support electrical and solar projects in Kenya."
      sections={[
        { title: "What we collect", body: "We collect details you provide when you create an account, request a quote, place an order, contact our team, or arrange delivery. This can include your name, phone number, email, delivery details, and order information." },
        { title: "How we use it", body: "We use your information to confirm orders, arrange pickup or delivery, provide installation and warranty support, prevent fraud, improve our catalogue, and respond to your questions. We do not sell customer information." },
        { title: "Payments stay protected", body: "Payment processing is handled by the selected payment provider. Dantown does not ask for your PIN or full card details through chat, email, or an unsolicited phone call." },
        { title: "Your choices", body: "You can ask us to correct your details, explain how your information is being used, or close your account, subject to records we must keep for legal, accounting, or order-support purposes." },
        { title: "Contact Dantown", body: "For a privacy question, contact the Dantown Electrical team through the contact page and include the email address or phone number connected to your request." }
      ]}
    />
  );
}
