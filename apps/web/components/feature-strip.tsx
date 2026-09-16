import { CreditCard, Headphones, ShieldCheck, Truck } from "lucide-react";

const features = [
  { title: "Fast Delivery", text: "Kitale & beyond", icon: Truck },
  { title: "Genuine Products", text: "Trusted brands", icon: ShieldCheck },
  { title: "Expert Support", text: "We're here to help", icon: Headphones },
  { title: "Secure Payments", text: "M-Pesa, card & cash", icon: CreditCard }
];

export function FeatureStrip() {
  return (
    <section className="feature-strip" aria-label="Dantown service benefits">
      {features.map(({ title, text, icon: Icon }) => (
        <div className="feature-strip-item" key={title}>
          <span className="feature-strip-icon" aria-hidden="true"><Icon size={22} /></span>
          <span><strong>{title}</strong><small>{text}</small></span>
        </div>
      ))}
    </section>
  );
}
