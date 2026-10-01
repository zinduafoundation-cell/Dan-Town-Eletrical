import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProductSubmission } from "@/lib/product-ingest/ingest";

export const dynamic = "force-dynamic";

const approvalSchema = z.object({
  jobId: z.string().uuid("Job ID is invalid."),
  decision: z.enum(["approve", "reject"]),
  reviewNote: z.string().trim().max(500).nullable().optional(),
});

async function parseApprovalPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();

  return {
    jobId: formData.get("jobId"),
    decision: formData.get("decision"),
    reviewNote: formData.get("reviewNote") ?? null,
  };
}

type IngestionPayload = {
  product?: Partial<ProductSubmission>;
  existingProductId?: string | null;
};

function approvalResponse(
  request: Request,
  data: Record<string, unknown>
) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const decision =
      typeof data.decision === "string"
        ? data.decision
        : "complete";

    return NextResponse.redirect(
      new URL(
        `/admin/automation/inbox?status=${decision}`,
        request.url
      ),
      303
    );
  }

  return NextResponse.json({
    ok: true,
    ...data,
  });
}

function slugify(
  value: string,
  normalizeProductName: (value: string) => string
) {
  return normalizeProductName(value)
    .replace(/ /g, "-")
    .slice(0, 90);
}

export async function POST(request: Request) {
  try {
    /*
     * Load server-dependent modules at request time.
     * This prevents environment/database initialization
     * while Next.js/Vercel is collecting route data.
     */
    const [
      { hasPermission },
      { getAuthorizationContext },
      { createSupabaseAdminClient },
      {
        normalizeProductName,
        ProductSubmissionSchema,
      },
    ] = await Promise.all([
      import("@dantown/auth"),
      import("@/lib/auth/server"),
      import("@/lib/supabase/admin"),
      import("@/lib/product-ingest/ingest"),
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

    if (
      !hasPermission(context, "automation.manage") ||
      !hasPermission(context, "products.update")
    ) {
      return NextResponse.json(
        {
          error: "Product approval permission required.",
        },
        {
          status: 403,
        }
      );
    }

    const payload = approvalSchema.parse(
      await parseApprovalPayload(request)
    );

    const supabase = createSupabaseAdminClient();

    const {
      data: job,
      error: jobError,
    } = await supabase
      .from("automation_jobs")
      .select("id, status, payload")
      .eq("id", payload.jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        {
          error: "Product ingestion job not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      job.status === "COMPLETED" ||
      job.status === "PROCESSING_FAILED"
    ) {
      return NextResponse.json(
        {
          error:
            "This ingestion job has already been resolved.",
        },
        {
          status: 409,
        }
      );
    }

    const ingestion =
      (job.payload as IngestionPayload | null) ?? {};

    /*
     * REJECT PRODUCT
     */
    if (payload.decision === "reject") {
      await supabase
        .from("automation_jobs")
        .update({
          status: "PROCESSING_FAILED",
          error_message:
            payload.reviewNote ??
            "Rejected during product review.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", payload.jobId);

      return approvalResponse(request, {
        decision: payload.decision,
        jobId: payload.jobId,
      });
    }

    /*
     * VALIDATE PRODUCT
     */
    const validated =
      ProductSubmissionSchema.safeParse(
        ingestion.product
      );

    if (!validated.success) {
      return NextResponse.json(
        {
          error:
            "Queued product data is no longer valid.",
          details: validated.error.issues,
        },
        {
          status: 422,
        }
      );
    }

    const product = validated.data;
    const existingId =
      ingestion.existingProductId ?? null;

    const now = new Date().toISOString();

    /*
     * UPDATE EXISTING PRODUCT
     */
    if (existingId) {
      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from("products")
        .select(
          "id, sku, name, slug, brand_id, category_id"
        )
        .eq("id", existingId)
        .single();

      if (existingError || !existing) {
        return NextResponse.json(
          {
            error:
              "The matched product no longer exists.",
          },
          {
            status: 409,
          }
        );
      }

      const update = {
        name: product.name,
        sku: product.sku ?? existing.sku,
        barcode: product.barcode ?? null,
        cost_price:
          product.costPrice ?? undefined,
        retail_price:
          product.sellingPrice ?? undefined,
        wholesale_price:
          product.wholesalePrice ?? undefined,
        description:
          product.description ?? null,
        updated_by:
          context.userId === "dev-bypass-user"
            ? null
            : context.userId,
        updated_at: now,
      };

      const { error } = await supabase
        .from("products")
        .update(update)
        .eq("id", existing.id);

      if (error) {
        throw error;
      }

      await supabase
        .from("automation_jobs")
        .update({
          status: "COMPLETED",
          error_message: null,
          completed_at: now,
        })
        .eq("id", payload.jobId);

      return approvalResponse(request, {
        decision: payload.decision,
        jobId: payload.jobId,
        productId: existing.id,
        action: "UPDATE_EXISTING",
      });
    }

    /*
     * CREATE NEW PRODUCT
     */
    if (
      !product.sku ||
      product.sellingPrice == null
    ) {
      return NextResponse.json(
        {
          error:
            "New products require a SKU and selling price before approval.",
        },
        {
          status: 422,
        }
      );
    }

    const {
      data: duplicate,
      error: duplicateError,
    } = await supabase
      .from("products")
      .select("id")
      .eq("sku", product.sku)
      .maybeSingle();

    if (duplicateError) {
      throw duplicateError;
    }

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "A product with this SKU already exists. Review it as an update instead.",
        },
        {
          status: 409,
        }
      );
    }

    const { data: created, error: createError } =
      await supabase
        .from("products")
        .insert({
          sku: product.sku,
          barcode: product.barcode ?? null,
          name: product.name,
          slug: slugify(
            `${product.sku}-${product.name}`,
            normalizeProductName
          ),
          short_description: null,
          description:
            product.description ?? null,
          category_id: null,
          brand_id: null,
          cost_price:
            product.costPrice ?? 0,
          retail_price:
            product.sellingPrice,
          contractor_price: null,
          wholesale_price:
            product.wholesalePrice ?? null,
          dealer_price: null,
          promotional_price: null,
          vat_rate: 16,
          weight: null,
          length: null,
          width: null,
          height: null,
          warranty_period: null,
          seo_title: null,
          seo_description: null,
          created_by:
            context.userId === "dev-bypass-user"
              ? null
              : context.userId,
          updated_by: null,
          created_at: now,
          updated_at: now,
          status: "DRAFT",
          featured: false,
          is_active: false,
        })
        .select("id")
        .single();

    if (createError || !created) {
      throw (
        createError ??
        new Error("Product was not created.")
      );
    }

    /*
     * SAVE PRODUCT IMAGE
     */
    if (product.imageUrl) {
      const { error: imageError } =
        await supabase
          .from("product_images")
          .insert({
            product_id: created.id,
            image_url: product.imageUrl,
            alt_text: product.name,
            sort_order: 0,
            is_primary: true,
            created_at: now,
          });

      if (imageError) {
        console.error(
          "Product image insert failed:",
          imageError
        );
      }
    }

    /*
     * COMPLETE AUTOMATION JOB
     */
    await supabase
      .from("automation_jobs")
      .update({
        status: "COMPLETED",
        error_message: null,
        completed_at: now,
      })
      .eq("id", payload.jobId);

    return approvalResponse(request, {
      decision: payload.decision,
      jobId: payload.jobId,
      productId: created.id,
      action: "CREATE_NEW",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            "Please provide a valid product approval request.",
          details: error.issues,
        },
        {
          status: 400,
        }
      );
    }

    console.error(
      "Product approval failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Product approval failed.",
      },
      {
        status: 500,
      }
    );
  }
}