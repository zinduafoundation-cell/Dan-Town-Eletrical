"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2 } from "lucide-react";

export function DeliveryProofSubmission({
  orderId,
  proofRecorded
}: {
  orderId: string;
  proofRecorded: boolean;
}) {
  const router = useRouter();
  const [proof, setProof] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proof) {
      setError("Choose a delivery photo or signature to submit.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setMessage(null);
      const formData = new FormData();
      formData.set("proof", proof);
      const response = await fetch(`/api/orders/${orderId}/delivery-proof`, {
        method: "POST",
        body: formData
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to submit delivery proof.");
      }

      setMessage(result.message);
      setProof(null);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to submit delivery proof.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="delivery-proof-form" onSubmit={submitProof}>
      <div>
        {proofRecorded ? <CheckCircle2 size={18} /> : <Camera size={18} />}
        <span>
          {proofRecorded
            ? "Your delivery confirmation and proof are saved."
            : "Confirm you received your order by uploading a photo or signature."}
        </span>
      </div>
      <label>
        Delivery photo or signature
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setProof(event.currentTarget.files?.[0] ?? null)}
          required={!proofRecorded}
        />
        <small>JPG, PNG, or WebP · up to 5 MB</small>
      </label>
      <button className="button button-primary" type="submit" disabled={isSubmitting || !proof}>
        {isSubmitting ? "Saving confirmation..." : proofRecorded ? "Replace proof and reconfirm" : "Confirm delivery"}
      </button>
      {message && <p className="order-action-message success" role="status">{message}</p>}
      {error && <p className="order-action-message error" role="alert">{error}</p>}
    </form>
  );
}
