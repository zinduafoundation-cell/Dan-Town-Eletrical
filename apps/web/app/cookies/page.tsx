import { PolicyPage } from "@/components/policy-page";

export default function CookiesPage() {
  return <PolicyPage eyebrow="Dantown website choices" title="A simple cookie notice." intro="Dantown uses small browser technologies to keep the website useful, secure, and easier to improve. We do not use cookies to sell your personal information." sections={[
    { title: "Essential cookies", body: "These support sign-in sessions, shopping cart behaviour, security, and the basic operation of the site. The website may not work correctly if they are blocked." },
    { title: "Preference cookies", body: "These can remember choices that make the site more convenient, such as a recent account or catalogue interaction." },
    { title: "Measurement", body: "Where enabled, privacy-conscious measurement helps us understand which pages are useful and where customers need clearer information. It is not used to identify you personally." },
    { title: "Your browser controls", body: "You can clear or block cookies from your browser settings. If you do, some account, cart, or checkout features may need to be restarted." }
  ]} />;
}
