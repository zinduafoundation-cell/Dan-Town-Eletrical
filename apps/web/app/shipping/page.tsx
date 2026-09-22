import { PolicyPage } from "@/components/policy-page";

export default function ShippingPage() {
  return <PolicyPage eyebrow="Dantown shipping" title="The right products, prepared for the journey." intro="We package electrical, lighting, and solar products carefully and confirm the practical delivery or collection option before fulfilment." sections={[
    { title: "Order confirmation first", body: "We confirm product availability, quantities, destination, and the applicable delivery charge before an order is released for fulfilment." },
    { title: "Packed for the product", body: "Fragile lighting, electronic equipment, batteries, and long electrical materials are prepared according to their size and handling needs." },
    { title: "Delivery charges", body: "Charges depend on destination, order size, urgency, and whether special handling is needed. Any charge is shown or confirmed before dispatch." },
    { title: "Track the handover", body: "Our team may call or message when an order is ready, on its way, or needs a delivery detail confirmed. Please inspect the package at handover." }
  ]} />;
}
