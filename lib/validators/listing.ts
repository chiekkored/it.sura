import { z } from "zod";

export const listingSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    slug: z
      .string()
      .min(1, "Slug is required")
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase with hyphens only"),
    price: z.coerce.number().min(0, "Price must be 0 or greater"),
    size: z.string().max(50).optional().or(z.literal("")),
    inventory: z
      .array(
        z.object({
          size: z.string().min(1, "Size is required"),
          quantity: z.coerce.number().int().min(0, "Quantity must be 0 or more"),
        }),
      )
      .optional()
      .default([]),
    description: z.string().max(5000).optional().or(z.literal("")),
    category_id: z.string().uuid("Category is required"),
    is_active: z.boolean().default(true),
  })
  .superRefine((values, context) => {
    const sizes = values.inventory.map((item) => item.size);
    const duplicateSize = sizes.find((size, index) => sizes.indexOf(size) !== index);

    if (duplicateSize) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${duplicateSize} can only be added once.`,
        path: ["inventory"],
      });
    }
  });

export type ListingFormValues = z.infer<typeof listingSchema>;
