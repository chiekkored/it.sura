import { z } from "zod";

export const salePaymentMethodSchema = z.enum(["cash", "gcash", "bank_transfer", "card", "other"]);

export const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        listing_id: z.string().uuid(),
        size: z.string().min(1, "Size is required"),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(999),
      }),
    )
    .min(1, "Sale must include at least one item"),
  payment_method: salePaymentMethodSchema,
  amount_paid: z.coerce.number().min(0, "Amount paid must be at least 0"),
});

export type CreateSaleValues = z.infer<typeof createSaleSchema>;
