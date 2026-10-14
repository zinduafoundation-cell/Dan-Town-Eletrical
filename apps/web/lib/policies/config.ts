export type PolicyGroup =
  | "Customer Purchases"
  | "Payments & Delivery"
  | "Privacy & Security"
  | "Legal Information";

export type PolicySection = {
  title: string;
  body: string;
};

export type Policy = {
  slug: string;
  title: string;
  group: PolicyGroup;
  summary: string;
  sections: PolicySection[];
  related: string[];
};

export const policyLastUpdated = "2026-10-14";

const draftNotice =
  "DRAFT — this section needs confirmation by Dantown and legal review before publication. Replace bracketed fields with approved business details; do not treat this draft as a final commitment.";

export const policies: Policy[] = [
  {
    slug: "returns-refunds",
    title: "Returns & refunds",
    group: "Customer Purchases",
    summary: "Draft guidance for return eligibility, assessment, and refund handling. No return window or refund promise is set by this draft.",
    sections: [
      { title: "Eligibility and condition", body: `Define eligible products, condition and packaging requirements, proof of purchase, exclusions, and the review process. ${draftNotice}` },
      { title: "Requesting a return", body: `Confirm the approved contact channel, required order information, collection or drop-off arrangements, and expected response times. Add [[returns_contact]] and [[approved_return_process]]. ${draftNotice}` },
      { title: "Refund method and timing", body: `Confirm how approved refunds are issued, who bears any return costs, and applicable timelines. Do not promise a period until it has been approved. ${draftNotice}` }
    ],
    related: ["cancellations", "payments", "delivery"]
  },
  {
    slug: "warranty",
    title: "Warranty",
    group: "Customer Purchases",
    summary: "Draft guidance for manufacturer and Dantown warranty information, claims, exclusions, and evidence.",
    sections: [
      { title: "Coverage", body: `State the warranty provider and the exact term and coverage for each product only where confirmed by its manufacturer or written order documents. Add [[warranty_contact]]. ${draftNotice}` },
      { title: "Making a claim", body: `Confirm the claim channel, required proof of purchase, product identification, inspection steps, and any safe return instructions. ${draftNotice}` },
      { title: "Limits and remedies", body: `List only verified product-specific exclusions and available remedies. Do not imply that this draft replaces manufacturer terms or applicable consumer rights. ${draftNotice}` }
    ],
    related: ["returns-refunds", "product-safety", "installation-services"]
  },
  {
    slug: "delivery",
    title: "Delivery",
    group: "Payments & Delivery",
    summary: "Draft information about delivery options, coverage, charges, estimated timing, and delivery issues.",
    sections: [
      { title: "Options, coverage, and charges", body: `Add approved delivery areas [[delivery_coverage]], available methods, fees [[delivery_fees]], and any collection arrangements. ${draftNotice}` },
      { title: "Timing and handover", body: `Publish estimates only after confirming the order, stock, destination, and carrier. Define how a recipient or delivery issue is handled. ${draftNotice}` },
      { title: "Damaged, missing, or delayed orders", body: `Provide the confirmed support route [[delivery_contact]] and the information customers should share. Do not promise an outcome or deadline until approved. ${draftNotice}` }
    ],
    related: ["payments", "cancellations", "complaints"]
  },
  {
    slug: "payments",
    title: "Payments",
    group: "Payments & Delivery",
    summary: "Draft information about accepted payment methods, payment confirmation, and payment issues.",
    sections: [
      { title: "Available methods", body: `List only the payment options actually shown at checkout for the order. Availability may vary by order and must be confirmed in the live checkout. ${draftNotice}` },
      { title: "Confirmation and reconciliation", body: `Explain that an order is treated as paid only after the payment provider or Dantown system confirms it. Provide [[payment_support_contact]] for unresolved discrepancies. ${draftNotice}` },
      { title: "Payment security", body: `Describe only verified payment-provider handling and the information Dantown actually receives. Never request a customer's PIN, password, or one-time code. ${draftNotice}` }
    ],
    related: ["cancellations", "returns-refunds", "privacy"]
  },
  {
    slug: "cancellations",
    title: "Cancellations",
    group: "Customer Purchases",
    summary: "Draft guidance for requesting order cancellation and determining whether an order can still be changed.",
    sections: [
      { title: "Requesting a cancellation", body: `Add the approved contact channel [[cancellation_contact]] and the order details customers should provide. A request is not confirmed until Dantown confirms its outcome. ${draftNotice}` },
      { title: "Order status and outcome", body: `Define how requests are assessed against actual fulfilment status, custom or special-order products, and supplier commitments. Do not promise cancellation or refund eligibility here. ${draftNotice}` },
      { title: "Payment reversal", body: `Link to the approved refund process and explain only verified provider steps. Add the final timing and method after they are confirmed. ${draftNotice}` }
    ],
    related: ["returns-refunds", "payments", "delivery"]
  },
  {
    slug: "privacy",
    title: "Privacy",
    group: "Privacy & Security",
    summary: "Draft notice of personal information collected, why it is used, who receives it, and how customers can contact Dantown.",
    sections: [
      { title: "Information and purposes", body: `Document the information collected by the live app and the actual purposes for orders, accounts, support, security, and analytics. Confirm retention and applicable legal bases with counsel. ${draftNotice}` },
      { title: "Service providers and transfers", body: `List the actual processors used by production, their roles, and any relevant data locations or transfers. Do not publish a vendor or transfer claim until verified. ${draftNotice}` },
      { title: "Choices and requests", body: `Add the verified privacy contact [[privacy_contact]], request method, and handling process. Confirm applicable rights and response periods with qualified counsel. ${draftNotice}` }
    ],
    related: ["cookies", "terms", "legal-notice"]
  },
  {
    slug: "terms",
    title: "Terms of use and sale",
    group: "Legal Information",
    summary: "Draft terms for using the site and placing orders. Final terms require review and approval before customers are asked to accept them.",
    sections: [
      { title: "Using the site", body: `Set approved rules for account security, permitted use, product information, and site availability. Add the correct contracting business identity [[legal_business_name]]. ${draftNotice}` },
      { title: "Orders and pricing", body: `Describe the real order acceptance, stock, price, quotation, and payment workflow. Confirm how errors and changes are handled; do not add unverified guarantees. ${draftNotice}` },
      { title: "Applicable terms and contact", body: `Confirm governing terms and dispute handling with counsel, and add [[legal_contact]] and [[legal_effective_date]]. This draft is not legal advice. ${draftNotice}` }
    ],
    related: ["pricing-quotations", "payments", "returns-refunds", "privacy"]
  },
  {
    slug: "product-safety",
    title: "Product safety",
    group: "Customer Purchases",
    summary: "Draft safety guidance directing customers to verified manufacturer instructions and qualified professionals.",
    sections: [
      { title: "Product information", body: `Use the product's actual label, verified specification, and manufacturer safety instructions. Confirm that product descriptions and any certifications are accurate before publication. ${draftNotice}` },
      { title: "Safe handling and installation", body: `Electrical products can present hazards if selected, handled, or installed incorrectly. Follow the manufacturer's instructions and consult a suitably qualified professional where appropriate. Confirm jurisdiction-specific wording with counsel. ${draftNotice}` },
      { title: "Safety concern or recall", body: `Add the verified product-safety contact [[safety_contact]] and internal escalation process. Do not claim a recall or safety certification unless confirmed. ${draftNotice}` }
    ],
    related: ["warranty", "installation-services", "complaints"]
  },
  {
    slug: "installation-services",
    title: "Installation services",
    group: "Customer Purchases",
    summary: "Draft scope for installation enquiries, site assessment, quotations, scheduling, and service responsibilities.",
    sections: [
      { title: "Scope and quotation", body: `List only services Dantown has confirmed it offers. Define when a site assessment, written scope, and approved quotation are required. Add [[installation_service_area]]. ${draftNotice}` },
      { title: "Scheduling and access", body: `Confirm how visits are arranged, any customer preparation, access requirements, and what happens if a visit must change. Do not publish unconfirmed availability or coverage. ${draftNotice}` },
      { title: "Work, safety, and support", body: `Confirm qualifications, responsibility boundaries, safety procedures, warranties, and the post-service contact with the responsible team before publication. ${draftNotice}` }
    ],
    related: ["product-safety", "warranty", "complaints"]
  },
  {
    slug: "complaints",
    title: "Complaints",
    group: "Customer Purchases",
    summary: "Draft route for raising a concern and receiving an acknowledged, reviewed response.",
    sections: [
      { title: "How to raise a concern", body: `Add the verified channel [[complaints_contact]] and details needed to locate an order or service. Avoid sending passwords, payment PINs, or full card details. ${draftNotice}` },
      { title: "Review and response", body: `Confirm who reviews complaints, how acknowledgement and updates work, escalation, and any response targets before publishing them. ${draftNotice}` },
      { title: "External escalation", body: `Have counsel confirm any applicable external complaint or dispute-resolution routes and the correct official contact details. ${draftNotice}` }
    ],
    related: ["returns-refunds", "delivery", "installation-services"]
  },
  {
    slug: "pricing-quotations",
    title: "Pricing & quotations",
    group: "Payments & Delivery",
    summary: "Draft explanation of displayed prices, quotation scope, validity, and changes.",
    sections: [
      { title: "Displayed prices", body: `Confirm whether each displayed price includes applicable tax, what currency and rounding are used, and how delivery charges appear before an order is placed. ${draftNotice}` },
      { title: "Quotations", body: `A quotation should state its actual scope, assumptions, price, validity, and any exclusions. Do not rely on this draft to invent a validity period or bind a price. ${draftNotice}` },
      { title: "Corrections and changes", body: `Define an approved process for pricing errors, availability changes, and customer communication. Confirm customer rights and the final terms with counsel. ${draftNotice}` }
    ],
    related: ["terms", "payments", "delivery"]
  },
  {
    slug: "promotions",
    title: "Promotions",
    group: "Payments & Delivery",
    summary: "Draft requirements for publishing clear promotion terms without implying an offer that is not active.",
    sections: [
      { title: "Offer details", body: `For each live promotion, show the actual products, price or benefit, start and end dates, eligibility, and any limits before customers rely on it. ${draftNotice}` },
      { title: "Applying an offer", body: `Explain how the offer is applied and how it appears in checkout. Do not publish a discount, stock claim, or exclusivity claim unless verified. ${draftNotice}` },
      { title: "Changes and questions", body: `Confirm how an active offer may be corrected or withdrawn and provide [[promotion_contact]]. Have counsel approve required offer disclosures. ${draftNotice}` }
    ],
    related: ["pricing-quotations", "terms", "payments"]
  },
  {
    slug: "cookies",
    title: "Cookies & similar technologies",
    group: "Privacy & Security",
    summary: "Draft inventory and explanation of browser storage and similar technologies. Confirm the production inventory before publication.",
    sections: [
      { title: "What the site uses", body: `The app uses authentication cookies and browser storage for site features, including shopping preferences and offline/POS workflows; verify each cookie, storage key, purpose, lifetime, and whether it is strictly necessary. A service worker and Vercel Speed Insights are also present and their production behavior must be reviewed. ${draftNotice}` },
      { title: "Optional technologies and choices", body: `No optional analytics or advertising consent controls are represented by this page. If optional technologies are enabled, document them and implement any required choice mechanism before deployment. ${draftNotice}` },
      { title: "Managing browser storage", body: `Explain browser controls and the impact of clearing necessary storage only after verifying the actual behavior. Add [[privacy_contact]] for questions. ${draftNotice}` }
    ],
    related: ["privacy", "terms", "legal-notice"]
  },
  {
    slug: "legal-notice",
    title: "Legal notice",
    group: "Legal Information",
    summary: "Draft legal identity and contact notice. Business registration and contact information must be supplied and verified.",
    sections: [
      { title: "Business identity", body: `Legal business name: [[legal_business_name]]. Registration or tax details: [[registration_details]]. Publish only details confirmed by an authorized representative. ${draftNotice}` },
      { title: "Contact and address", body: `Registered or service address: [[business_address]]. Email: [[business_email]]. Phone: [[business_phone]]. Confirm which details are appropriate for publication. ${draftNotice}` },
      { title: "Content and effective date", body: `Confirm rights and attribution for site content, applicable notices, and [[legal_effective_date]] with counsel. Do not treat placeholders as actual details. ${draftNotice}` }
    ],
    related: ["terms", "privacy", "cookies"]
  }
];

export const policyGroups: PolicyGroup[] = [
  "Customer Purchases",
  "Payments & Delivery",
  "Privacy & Security",
  "Legal Information"
];

export function getPolicy(slug: string) {
  return policies.find((policy) => policy.slug === slug);
}

export function getRelatedPolicies(policy: Policy) {
  return policy.related.map(getPolicy).filter((related): related is Policy => Boolean(related));
}
