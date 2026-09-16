import type { Metadata } from "next";
import { StorefrontShell } from "@/components/storefront";

export const metadata: Metadata = {
  title: "Contact Dantown Electrical",
  description:
    "Contact Dantown Electrical in Kitale for electrical products, lighting, solar solutions, quotations, project support and customer assistance."
};

const contactTopics = [
  {
    icon: "💡",
    title: "Product Guidance",
    description:
      "Not sure which electrical, lighting or power product you need? Our team can help you choose."
  },
  {
    icon: "🧾",
    title: "Request a Quote",
    description:
      "Send us your project requirements and receive guidance for your electrical or power needs."
  },
  {
    icon: "⚡",
    title: "Project Support",
    description:
      "Get assistance for homes, businesses, construction projects, installations and electrical planning."
  },
  {
    icon: "🔧",
    title: "After-Sales Support",
    description:
      "Already purchased from us? Contact our support team for product and order assistance."
  }
];

const businessHours = [
  { day: "Monday", hours: "8:00 AM – 6:00 PM" },
  { day: "Tuesday", hours: "8:00 AM – 6:00 PM" },
  { day: "Wednesday", hours: "8:00 AM – 6:00 PM" },
  { day: "Thursday", hours: "8:00 AM – 6:00 PM" },
  { day: "Friday", hours: "8:00 AM – 6:00 PM" },
  { day: "Saturday", hours: "8:30 AM – 5:00 PM" },
  { day: "Sunday", hours: "Closed" }
];

const faqs = [
  {
    question: "Can I request a quotation before buying?",
    answer:
      "Yes. Send us the products or project requirements you need and our team can guide you through the quotation process."
  },
  {
    question: "Can you help me choose the right product?",
    answer:
      "Yes. Tell us what you are building, repairing or installing and we can help you identify suitable products."
  },
  {
    question: "Can I contact you about an existing order?",
    answer:
      "Yes. Include your order number, if available, together with a short explanation of what you need help with."
  },
  {
    question: "Can businesses and contractors contact Dantown?",
    answer:
      "Yes. We support customers, electricians, contractors, businesses and project teams with product and project enquiries."
  }
];

export default function ContactPage() {
  return (
    <StorefrontShell>
      <main className="page-shell contact-page-shell">
        {/* HERO */}
        <section className="page-hero contact-hero">
          <div className="contact-hero-content">
            <p className="eyebrow">DANTOWN ELECTRICAL SUPPORT</p>

            <h1>
              Let&apos;s power your
              <span> next project.</span>
            </h1>

            <p className="contact-hero-description">
              Need electrical products, lighting, solar solutions, a quotation
              or project support? Contact the Dantown Electrical team and let us
              help you find the right solution.
            </p>

            <div className="contact-hero-actions">
              <a
                href="tel:+254745917655"
                className="button button-primary"
              >
                📞 Call Us Now
              </a>

              <a
                href="mailto:hello@dantownelectrical.co.ke"
                className="button button-secondary"
              >
                ✉️ Send an Email
              </a>
            </div>

            <div className="contact-hero-trust">
              <span>⚡ Electrical Solutions</span>
              <span>💡 Lighting</span>
              <span>🔋 Power & Solar</span>
              <span>📍 Kitale, Kenya</span>
            </div>
          </div>

          <div className="contact-hero-card content-panel">
            <div className="contact-status">
              <span className="status-dot" />
              <span>Customer support available</span>
            </div>

            <h2>How can we help?</h2>

            <p>
              Choose the fastest way to reach the Dantown Electrical team.
            </p>

            <div className="quick-contact-list">
              <a href="tel:+254745917655" className="quick-contact-item">
                <span className="quick-contact-icon">📞</span>

                <span>
                  <strong>Call Dantown</strong>
                  <small>+254 745 917 655</small>
                </span>

                <span className="quick-contact-arrow">→</span>
              </a>

              <a
                href="mailto:hello@dantownelectrical.co.ke"
                className="quick-contact-item"
              >
                <span className="quick-contact-icon">✉️</span>

                <span>
                  <strong>Email Support</strong>
                  <small>hello@dantownelectrical.co.ke</small>
                </span>

                <span className="quick-contact-arrow">→</span>
              </a>

              <div className="quick-contact-item">
                <span className="quick-contact-icon">📍</span>

                <span>
                  <strong>Visit Our Store</strong>
                  <small>Kitale, Kenya</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT TOPICS */}
        <section className="contact-section">
          <div className="section-heading">
            <p className="eyebrow">WHAT WE CAN HELP WITH</p>
            <h2>Smart support for every electrical need.</h2>
            <p>
              Whether you need one product or support for a complete project,
              send us your requirements.
            </p>
          </div>

          <div className="contact-topic-grid">
            {contactTopics.map((topic) => (
              <article
                key={topic.title}
                className="content-panel contact-topic-card"
              >
                <div className="contact-topic-icon">{topic.icon}</div>

                <h3>{topic.title}</h3>

                <p>{topic.description}</p>

                <a href="#contact-form" className="text-link">
                  Get help <span>→</span>
                </a>
              </article>
            ))}
          </div>
        </section>

        {/* MAIN CONTACT AREA */}
        <section className="contact-main-grid" id="contact-form">
          {/* CONTACT INFORMATION */}
          <aside className="contact-information-column">
            <div className="content-panel contact-info-card">
              <p className="eyebrow">CONTACT DETAILS</p>
              <h2>Talk to a real person.</h2>

              <p className="contact-info-intro">
                Tell us what you need. Include product names, quantities or
                project details where possible so our team can assist you
                faster.
              </p>

              <div className="contact-detail-list">
                <div className="contact-detail">
                  <div className="contact-detail-icon">📞</div>

                  <div>
                    <span>Phone</span>
                    <a href="tel:+254745917655">
                      +254 745 917 655
                    </a>
                  </div>
                </div>

                <div className="contact-detail">
                  <div className="contact-detail-icon">✉️</div>

                  <div>
                    <span>Email</span>
                    <a href="mailto:hello@dantownelectrical.co.ke">
                      hello@dantownelectrical.co.ke
                    </a>
                  </div>
                </div>

                <div className="contact-detail">
                  <div className="contact-detail-icon">📍</div>

                  <div>
                    <span>Location</span>
                    <strong>Kitale, Kenya</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="content-panel business-hours-card">
              <div className="hours-heading">
                <div>
                  <p className="eyebrow">STORE HOURS</p>
                  <h3>Business hours</h3>
                </div>

                <span className="hours-icon">🕒</span>
              </div>

              <div className="hours-list">
                {businessHours.map((item) => (
                  <div className="hours-row" key={item.day}>
                    <span>{item.day}</span>
                    <strong>{item.hours}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="content-panel dan-t-contact-card">
              <div className="dan-t-contact-icon">🤖</div>

              <div>
                <p className="eyebrow">DAN T AI</p>
                <h3>Need help right now?</h3>

                <p>
                  Use DAN T AI to ask about products, availability, categories
                  and general Dantown Electrical information.
                </p>

                <button
                  type="button"
                  className="button button-secondary"
                >
                  Ask DAN T AI
                </button>
              </div>
            </div>
          </aside>

          {/* CONTACT FORM */}
          <section className="content-panel contact-form-card">
            <div className="contact-form-heading">
              <div>
                <p className="eyebrow">SEND A MESSAGE</p>
                <h2>Tell us what you need.</h2>
              </div>

              <span className="contact-form-badge">
                🔒 Your information stays protected
              </span>
            </div>

            <p className="contact-form-description">
              Complete the form below and provide as much information as
              possible about your request.
            </p>

            <form className="quote-form contact-smart-form">
              <div className="form-grid">
                <label>
                  <span>Full Name *</span>

                  <input
                    type="text"
                    name="name"
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </label>

                <label>
                  <span>Phone Number</span>

                  <input
                    type="tel"
                    name="phone"
                    placeholder="+254..."
                    autoComplete="tel"
                  />
                </label>
              </div>

              <label>
                <span>Email Address *</span>

                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <div className="form-grid">
                <label>
                  <span>What do you need help with? *</span>

                  <select name="topic" required defaultValue="">
                    <option value="" disabled>
                      Select a topic
                    </option>
                    <option value="product-guidance">
                      Product Guidance
                    </option>
                    <option value="quotation">
                      Request a Quotation
                    </option>
                    <option value="project-support">
                      Project Support
                    </option>
                    <option value="existing-order">
                      Existing Order
                    </option>
                    <option value="after-sales">
                      After-Sales Support
                    </option>
                    <option value="other">
                      Other
                    </option>
                  </select>
                </label>

                <label>
                  <span>Preferred Contact Method</span>

                  <select name="preferredContact">
                    <option value="phone">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>
              </div>

              <label>
                <span>Order / Quote Number (Optional)</span>

                <input
                  type="text"
                  name="reference"
                  placeholder="Example: DTE-10245"
                />
              </label>

              <label>
                <span>Your Message *</span>

                <textarea
                  name="message"
                  rows={8}
                  placeholder="Tell us about the products, quantities or project you need help with..."
                  required
                />
              </label>

              <div className="contact-form-footer">
                <p>
                  By sending this message, you agree that Dantown Electrical
                  may contact you regarding your enquiry.
                </p>

                <button
                  type="submit"
                  className="button button-primary contact-submit-button"
                >
                  <span>Send Message</span>
                  <span>→</span>
                </button>
              </div>
            </form>
          </section>
        </section>

        {/* FAQ */}
        <section className="contact-section contact-faq-section">
          <div className="section-heading">
            <p className="eyebrow">HELP CENTRE</p>
            <h2>Frequently asked questions.</h2>
            <p>
              Quick answers before you contact our team.
            </p>
          </div>

          <div className="faq-list">
            {faqs.map((faq) => (
              <details key={faq.question} className="content-panel faq-item">
                <summary>
                  <span>{faq.question}</span>
                  <span className="faq-plus">+</span>
                </summary>

                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="content-panel contact-final-cta">
          <div>
            <p className="eyebrow">DANTOWN ELECTRICAL</p>

            <h2>Ready to get started?</h2>

            <p>
              Contact us for products, quotations, electrical solutions,
              lighting, power systems and project support.
            </p>
          </div>

          <div className="contact-final-actions">
            <a
              href="tel:+254745917655"
              className="button button-primary"
            >
              📞 Call Now
            </a>

            <a
              href="#contact-form"
              className="button button-secondary"
            >
              Send Enquiry
            </a>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}