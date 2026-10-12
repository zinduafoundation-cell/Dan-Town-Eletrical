import Link from "next/link";
import { redirect } from "next/navigation";
import { CentreLoginForm } from "@/components/auth/centre-login-form";
import { getAuthorizationContext } from "@/lib/auth/server";
import { hasBusinessCenterAccess } from "@/lib/auth/business-center-access";

export const dynamic = "force-dynamic";

export default async function CentreLoginPage() {
  const context = await getAuthorizationContext();
  const alreadyAuthorized = context
    ? await hasBusinessCenterAccess(context.userId)
    : false;

  if (alreadyAuthorized) redirect("/centre");

  if (context) {
    return (
      <main className="centre-login-page">
        <section className="centre-login-card" aria-labelledby="centre-login-title">
          <Link className="centre-login-brand" href="/">
            <span className="centre-login-brand-mark">D</span>
            <span>DANTOWN <b>ELECTRICAL</b></span>
          </Link>
          <p className="centre-login-eyebrow">STAFF ACCESS</p>
          <h1 id="centre-login-title">Centre access is not enabled</h1>
          <p className="centre-login-copy">
            This account is signed in, but an administrator has not granted it access to Dantown Centre.
            Ask your administrator to enable your staff access.
          </p>
          <Link className="centre-login-secondary" href="/logout">Sign out</Link>
          <Link className="centre-login-shop-link" href="/">Return to the shop</Link>
        </section>
      </main>
    );
  }

  return <CentreLoginForm />;
}
