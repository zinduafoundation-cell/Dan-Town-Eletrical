import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const approvalSchema = z.object({
  recommendationId: z.string().uuid("Recommendation ID is invalid."),

  decision: z
    .enum(["approve", "reject"])
    .default("approve"),

  reviewNote: z
    .union([
      z.string().trim().max(500),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((value) =>
      value === "" || value === null ? null : value
    ),
});

async function parseApprovalPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();

  return {
    recommendationId: formData.get("recommendationId"),
    decision: formData.get("decision") ?? "approve",
    reviewNote: formData.get("reviewNote") ?? null,
  };
}

export async function POST(request: Request) {
  try {
    /*
     * Load server-dependent modules at request time.
     * This prevents environment/database initialization
     * from happening while Next.js is collecting route data.
     */
    const [
      { hasPermission },
      { applyApprovedPricingRecommendation },
      { getAuthorizationContext },
      { createSupabaseAdminClient },
    ] = await Promise.all([
      import("@dantown/auth"),
      import("@dantown/database"),
      import("@/lib/auth/server"),
      import("@/lib/supabase/admin"),
    ]);

    const context = await getAuthorizationContext();

    if (!context) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    if (!hasPermission(context, "pricing.approve")) {
      return NextResponse.json(
        {
          error: "You do not have permission to approve pricing changes.",
        },
        {
          status: 403,
        }
      );
    }

    const rawBody = await parseApprovalPayload(request);

    const payload = approvalSchema.parse(rawBody);

    const supabase = createSupabaseAdminClient();

    const result = await applyApprovedPricingRecommendation(
      supabase,
      {
        recommendationId: payload.recommendationId,
        decision: payload.decision,
        reviewNote: payload.reviewNote,
        approvedBy: context.userId,
      }
    );

    const contentType =
      request.headers.get("content-type") ?? "";

    const isFormSubmission =
      contentType.includes(
        "application/x-www-form-urlencoded"
      ) ||
      contentType.includes("multipart/form-data");

    if (isFormSubmission) {
      const redirectUrl = new URL(
        `/admin/automation/pricing?status=${encodeURIComponent(
          payload.decision
        )}`,
        request.url
      );

      return NextResponse.redirect(redirectUrl, 303);
    }

    return NextResponse.json(
      {
        ok: true,
        data: result,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            "Please provide a valid recommendation and decision.",
          details: error.issues,
        },
        {
          status: 400,
        }
      );
    }

    console.error(
      "Failed to process pricing approval.",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process pricing approval.",
      },
      {
        status: 500,
      }
    );
  }
}