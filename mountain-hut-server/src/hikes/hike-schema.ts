import z from "zod";

import { phoneFormat } from "#src/shared/fields";
/**
 * API uses ISO 8601 instants (Z or explicit offset) to avoid ambiguous
 * Europe/Rome DST transitions. Values are normalized to UTC when persisted.
 */
export const registerHikeSchema = z
  .object({
    departureAt: z.iso.datetime({ offset: true }),
    expectedReturnAt: z.iso.datetime({ offset: true }),
    destination: z.string().trim().min(1).max(200),
    routeDescription: z.string().trim().min(1).max(2000),
    intermediatePoints: z
      .array(z.string().trim().min(1).max(200))
      .max(30)
      .optional(),
    emergencyContactPhone: phoneFormat.optional(),
  })
  .strict();

export type RegisterHikeInput = z.infer<typeof registerHikeSchema>;