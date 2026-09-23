import { PolicyPage } from "@/components/policy-page";

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Dantown Electrical terms"
      title="Straightforward terms for every order."
      intro="These terms set out how Dantown Electrical handles online orders, quotations, payments, delivery, pickup, and project support."
      sections={[
        { title: "Product information", body: "We work to keep descriptions, prices, availability, and images accurate. Stock and prices can change, and a quotation is confirmed only when Dantown has accepted it and shared the applicable payment or fulfilment details." },
        { title: "Orders and payment", body: "An order is prepared after the requested details are confirmed. You are responsible for checking product quantities, delivery information, and contact details before payment or collection." },
        { title: "Delivery and pickup", body: "Delivery timing depends on stock, destination, access, and order size. Someone authorised to receive the order should be available at the agreed location. Pickup is released after the order is confirmed ready." },
        { title: "Electrical safety", body: "Electrical and solar products must be installed and used by a suitably qualified person. Follow the manufacturer instructions and ask Dantown for installation support when you are unsure." },
        { title: "Returns and warranty", body: "Returns are governed by our seven-day returns policy. Warranty support depends on the product and manufacturer terms; misuse, unauthorised modification, and unsafe installation may affect eligibility." },
        { title: "Questions", body: "If an order or quotation is unclear, contact Dantown before making payment or starting installation so our team can help you choose the safest next step." }
      ]}
    />
  );
}
