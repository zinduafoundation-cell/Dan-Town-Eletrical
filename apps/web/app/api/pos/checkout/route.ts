import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getStaffIdentity,
  requireAuthorizedPermission,
} from "../../../../lib/auth/server";

import { createSupabaseServiceClient } from "../../../../lib/supabase/server";
import { invalidateCachePrefix } from "../../../../lib/core/cache";
import { emit } from "../../../../lib/core/events";

const paymentMethodSchema = z.enum([
  "cash",
  "card",
  "mpesa",
  "bank",
]);

const checkoutSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),

  customerName: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .default("Walk-in Customer"),

  subtotal: z
    .number()
    .finite()
    .nonnegative(),

  vat: z
    .number()
    .finite()
    .nonnegative(),

  total: z
    .number()
    .finite()
    .positive(),

  paymentMethod: paymentMethodSchema,

  splitPayments: z
    .array(
      z.object({
        method: paymentMethodSchema,
        amount: z
          .number()
          .finite()
          .positive(),
      }),
    )
    .length(2)
    .optional(),

  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z
          .number()
          .int()
          .positive(),
      }),
    )
    .min(1),
});

const paymentMethods = {
  cash: "CASH",
  card: "CARD",
  mpesa: "MPESA",
  bank: "BANK_TRANSFER",
} as const;

type ReceiptOrder = {
  id: string;
  order_number: string;
  total: number;
  payment_status: string;
  created_at: string;
  processed_by_staff_name: string | null;
  processed_by_staff_role: string | null;
};

type SyncRecord = {
  transaction_id: string;
  status: string;
  payload: unknown;
  order_id: string | null;
  retry_count: number | null;
};

export async function POST(request: Request) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. AUTHORIZE STAFF
     * ---------------------------------------------------------
     */

    const context =
      await requireAuthorizedPermission("orders.create");

    if (!context) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not authorized to create orders.",
        },
        { status: 401 },
      );
    }

    const staff = await getStaffIdentity(context);

    /*
     * ---------------------------------------------------------
     * 2. PARSE REQUEST
     * ---------------------------------------------------------
     */

    const body = await request.json();

    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Please check the sale details.",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const sale = parsed.data;

    /*
     * ---------------------------------------------------------
     * 3. BASIC FINANCIAL VALIDATION
     * ---------------------------------------------------------
     *
     * The database/RPC should perform the authoritative
     * inventory and financial validation as well.
     */

    const calculatedTotal =
      Math.round((sale.subtotal + sale.vat) * 100) / 100;

    if (
      Math.round(calculatedTotal * 100) !==
      Math.round(sale.total * 100)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Sale total does not match subtotal and VAT.",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. SPLIT PAYMENT VALIDATION
     * ---------------------------------------------------------
     */

    const splitPayments = sale.splitPayments;

    if (splitPayments) {
      const splitTotal = splitPayments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );

      if (
        Math.round(splitTotal * 100) !==
        Math.round(sale.total * 100)
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Split payment amounts must equal the sale total.",
          },
          { status: 400 },
        );
      }

      /*
       * Prevent using the same tender twice.
       */
      if (
        splitPayments[0].method ===
        splitPayments[1].method
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Split payment must use two different payment methods.",
          },
          { status: 400 },
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * 5. OFFLINE / IDEMPOTENCY INFORMATION
     * ---------------------------------------------------------
     */

    const offlineTransactionId =
      request.headers.get("X-Offline-Transaction-Id");

    const offlineDeviceId =
      request.headers.get("X-Offline-Device-Id") ||
      "unknown-device";

    if (offlineTransactionId) {
      const uuidResult =
        z.string().uuid().safeParse(
          offlineTransactionId,
        );

      if (!uuidResult.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid offline transaction identifier.",
          },
          { status: 400 },
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * 6. SUPABASE SERVICE CLIENT
     * ---------------------------------------------------------
     */

    const supabase =
      createSupabaseServiceClient();

    /*
     * ---------------------------------------------------------
     * 7. ORDER NUMBER
     * ---------------------------------------------------------
     *
     * Offline transactions get a deterministic order number
     * so retries cannot create another sale.
     */

    const orderNumber = offlineTransactionId
      ? `DT-OFF-${offlineTransactionId}`
      : `DT-${Date.now()
          .toString()
          .slice(-8)}`;

    /*
     * ---------------------------------------------------------
     * 8. OFFLINE SYNC RECORD
     * ---------------------------------------------------------
     */

    let syncTrackingAvailable = false;

    let syncRecord: SyncRecord | null = null;

    let offlineRetryCount = 0;

    if (offlineTransactionId) {
      const {
        data,
        error: syncLookupError,
      } = await supabase
        .from("pos_sync_records")
        .select(
          "transaction_id, status, payload, order_id, retry_count",
        )
        .eq(
          "transaction_id",
          offlineTransactionId,
        )
        .maybeSingle();

      syncTrackingAvailable =
        !syncLookupError;

      if (data) {
        syncRecord = data as SyncRecord;

        offlineRetryCount =
          syncRecord.retry_count ?? 0;
      }

      /*
       * If the sync record exists, make sure the retry
       * contains the exact same sale.
       */

      if (syncRecord) {
        const originalPayload =
          JSON.stringify(syncRecord.payload);

        const incomingPayload =
          JSON.stringify(sale);

        if (
          originalPayload !== incomingPayload
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Offline transaction payload conflicts with the original request.",
            },
            { status: 409 },
          );
        }

        /*
         * Already successfully synchronized.
         * Return the existing receipt instead of creating
         * another order.
         */

        if (
          syncRecord.status === "SYNCED" &&
          syncRecord.order_id
        ) {
          const {
            data: syncedOrder,
          } = await supabase
            .from("orders")
            .select(
              `
                id,
                order_number,
                total,
                payment_status,
                created_at,
                processed_by_staff_name,
                processed_by_staff_role
              `,
            )
            .eq(
              "id",
              syncRecord.order_id,
            )
            .maybeSingle();

          if (syncedOrder) {
            return receiptResponse(
              syncedOrder,
              sale.customerName,
              sale.paymentMethod,
            );
          }
        }
      }

      /*
       * Create/update sync tracking.
       */

      if (syncTrackingAvailable) {
        await supabase
          .from("pos_sync_records")
          .upsert(
            {
              transaction_id:
                offlineTransactionId,

              device_id:
                offlineDeviceId,

              staff_user_id:
                staff.userId,

              status: "SYNCING",

              payload: sale,

              retry_count:
                offlineRetryCount,

              error_message: null,

              order_id:
                syncRecord?.order_id ?? null,
            },
            {
              onConflict:
                "transaction_id",
            },
          );
      }
    }

    /*
     * ---------------------------------------------------------
     * 9. EXTRA IDEMPOTENCY CHECK
     * ---------------------------------------------------------
     */

    const {
      data: existingOrder,
    } = await supabase
      .from("orders")
      .select(
        `
          id,
          order_number,
          total,
          payment_status,
          created_at,
          processed_by_staff_name,
          processed_by_staff_role
        `,
      )
      .eq(
        "order_number",
        orderNumber,
      )
      .maybeSingle();

    if (existingOrder) {
      return receiptResponse(
        existingOrder,
        sale.customerName,
        sale.paymentMethod,
      );
    }

    /*
     * ---------------------------------------------------------
     * 10. BUILD RPC PAYLOAD
     * ---------------------------------------------------------
     */

    const baseRpcArgs = {
      sale_order_number: orderNumber,

      sale_customer_id:
        sale.customerId ?? null,

      sale_subtotal:
        sale.subtotal,

      sale_vat:
        sale.vat,

      sale_total:
        sale.total,

      sale_payment_method:
        paymentMethods[
          sale.paymentMethod
        ],

      sale_staff_user_id:
        staff.userId,

      sale_staff_name:
        staff.name,

      sale_staff_role:
        staff.role,

      sale_items:
        sale.items.map((item) => ({
          product_id:
            item.productId,

          quantity:
            item.quantity,
        })),
    };

    /*
     * ---------------------------------------------------------
     * 11. COMPLETE SALE
     * ---------------------------------------------------------
     */

    let data: ReceiptOrder | null = null;

    let rpcError: {
      message: string;
      code?: string;
    } | null = null;

    if (splitPayments) {
      const {
        data: splitData,
        error,
      } = await supabase.rpc(
        "complete_pos_sale_split",
        {
          ...baseRpcArgs,

          sale_split_payments:
            splitPayments.map(
              (payment) => ({
                method:
                  paymentMethods[
                    payment.method
                  ],

                amount:
                  payment.amount,
              }),
            ),
        },
      );

      data =
        splitData as ReceiptOrder | null;

      rpcError = error;
    } else {
      const {
        data: normalData,
        error,
      } = await supabase.rpc(
        "complete_pos_sale",
        baseRpcArgs,
      );

      data =
        normalData as ReceiptOrder | null;

      rpcError = error;
    }

    /*
     * ---------------------------------------------------------
     * 12. HANDLE RPC FAILURE
     * ---------------------------------------------------------
     */

    if (rpcError || !data) {
      console.error(
        "POS CHECKOUT ERROR",
        rpcError,
      );

      /*
       * The RPC may have completed the transaction even
       * though the network response was lost.
       *
       * Check the order number before marking it failed.
       */

      const {
        data: recoveredOrder,
      } = await supabase
        .from("orders")
        .select(
          `
            id,
            order_number,
            total,
            payment_status,
            created_at,
            processed_by_staff_name,
            processed_by_staff_role
          `,
        )
        .eq(
          "order_number",
          orderNumber,
        )
        .maybeSingle();

      if (recoveredOrder) {
        if (offlineTransactionId &&
            syncTrackingAvailable) {
          await supabase
            .from("pos_sync_records")
            .update({
              status: "SYNCED",
              order_id:
                recoveredOrder.id,
              synced_at:
                new Date().toISOString(),
              error_message: null,
            })
            .eq(
              "transaction_id",
              offlineTransactionId,
            );
        }

        return receiptResponse(
          recoveredOrder,
          sale.customerName,
          sale.paymentMethod,
        );
      }

      /*
       * Mark offline transaction failed.
       */

      if (
        offlineTransactionId &&
        syncTrackingAvailable
      ) {
        await supabase
          .from("pos_sync_records")
          .update({
            status: "FAILED",

            retry_count:
              offlineRetryCount + 1,

            error_message:
              rpcError?.message ??
              "Unable to complete sale.",
          })
          .eq(
            "transaction_id",
            offlineTransactionId,
          );
      }

      /*
       * Missing RPC / migration.
       */

      if (
        rpcError?.code === "PGRST202"
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "POS checkout is not installed in the connected database. Apply the required POS checkout migration before retrying.",
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          success: false,

          error:
            rpcError?.message ??
            "Unable to complete sale.",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 13. OFFLINE SUCCESS METADATA
     * ---------------------------------------------------------
     */

    if (offlineTransactionId) {
      const {
        error: syncMetadataError,
      } = await supabase
        .from("orders")
        .update({
          offline_transaction_id:
            offlineTransactionId,

          offline_device_id:
            offlineDeviceId,

          offline_sync_status:
            "SYNCED",

          offline_synced_at:
            new Date().toISOString(),

          offline_sync_error:
            null,
        })
        .eq(
          "id",
          data.id,
        );

      if (
        syncMetadataError &&
        !syncMetadataError.message.includes(
          "offline_transaction_id",
        )
      ) {
        console.error(
          "POS offline metadata update failed",
          syncMetadataError,
        );
      }

      if (syncTrackingAvailable) {
        await supabase
          .from("pos_sync_records")
          .update({
            status: "SYNCED",

            order_id:
              data.id,

            synced_at:
              new Date().toISOString(),

            error_message: null,
          })
          .eq(
            "transaction_id",
            offlineTransactionId,
          );
      }
    }

    /*
     * ---------------------------------------------------------
     * 14. CACHE INVALIDATION
     * ---------------------------------------------------------
     */

    try {
      await invalidateCachePrefix(
        "pos-products",
      );
    } catch (cacheError) {
      console.error(
        "POS cache invalidation failed",
        cacheError,
      );
    }

    /*
     * ---------------------------------------------------------
     * 15. EVENT
     * ---------------------------------------------------------
     */

    try {
      await emit(
        "SALE_COMPLETED",
        {
          orderId: data.id,

          orderNumber:
            data.order_number,

          total:
            Number(data.total),

          source: "POS",
        },
      );
    } catch (eventError) {
      /*
       * Event failure should not undo a successful sale.
       */
      console.error(
        "SALE_COMPLETED event failed",
        eventError,
      );
    }

    /*
     * ---------------------------------------------------------
     * 16. RECEIPT
     * ---------------------------------------------------------
     */

    return receiptResponse(
      data,
      sale.customerName,
      sale.paymentMethod,
    );
  } catch (error) {
    console.error(
      "POS CHECKOUT ERROR",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to complete sale.",
      },
      { status: 500 },
    );
  }
}

/*
 * ============================================================
 * RECEIPT RESPONSE
 * ============================================================
 */

function receiptResponse(
  order: ReceiptOrder,
  customer: string,
  paymentMethod: string,
) {
  return NextResponse.json({
    success: true,

    receipt: {
      orderId:
        order.id,

      receiptNumber:
        order.order_number,

      customer,

      total:
        Number(order.total),

      paymentMethod,

      paymentStatus:
        order.payment_status,

      servedBy:
        order.processed_by_staff_name,

      staffRole:
        order.processed_by_staff_role,

      createdAt:
        order.created_at,
    },
  });
}