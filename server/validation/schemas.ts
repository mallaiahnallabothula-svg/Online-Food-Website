import { z } from 'zod';

export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const DeliveryCalculationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  areaName: z.string().max(200).optional(),
  customerAddress: z.string().max(500).optional(),
});

export const CustomerDetailsSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be under 100 characters'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  address: z.string().trim().min(5, 'Delivery address must be at least 5 characters').max(500, 'Delivery address must be under 500 characters'),
  landmark: z.string().trim().max(200, 'Landmark must be under 200 characters').optional().default(''),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationLink: z.string().url('Location link must be a valid URL').max(500).optional()
    .refine((url) => !url || url.startsWith('https://'), 'Location URL must use HTTPS')
    .refine((url) => {
      if (!url) return true;
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        return (
          host === 'maps.google.com' ||
          host === 'goo.gl' ||
          host === 'maps.app.goo.gl' ||
          host === 'www.google.com' ||
          host.endsWith('.google.com')
        );
      } catch {
        return false;
      }
    }, 'Location link must be a valid Google Maps HTTPS link'),
});

export const CreatePaymentIntentSchema = z.object({
  jowarQuantity: z.number().int('Quantity must be an integer').min(0).max(500),
  chapathiQuantity: z.number().int('Quantity must be an integer').min(0).max(500),
  karamSelection: z.object({
    karivepaku: z.boolean(),
    aviseGinjalu: z.boolean(),
  }),
  customer: CustomerDetailsSchema,
}).refine((data) => data.jowarQuantity + data.chapathiQuantity >= 5 && [data.jowarQuantity, data.chapathiQuantity].every(quantity => quantity === 0 || quantity >= 5), {
  message: 'Select at least 5 of each chosen item',
  path: ['jowarQuantity'],
});

export const VerifyPaymentSchema = z.object({
  intentId: z.string().trim().min(5, 'Intent ID is required').max(100),
  providerPaymentId: z.string().trim().min(3, 'Provider payment ID is required').max(100),
  providerSignature: z.string().trim().max(256).optional(),
  mockVerificationToken: z.string().trim().max(100).optional(),
});

export const CustomerFeedbackSchema = z.object({
  rating: z
    .number()
    .int('Rating must be an integer between 1 and 5')
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  comment: z
    .string()
    .trim()
    .max(500, 'Comment must be under 500 characters')
    .optional()
    .transform((val) => (val ? val.replace(/<[^>]*>?/gm, '').trim() : undefined)),
  publicConsent: z.boolean().optional().default(false),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
});

export const AdminLoginSchema = z.object({
  username: z.string().trim().min(2, 'Username required').max(50),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export type CreatePaymentIntentInput = z.infer<typeof CreatePaymentIntentSchema>;
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;
export type CustomerFeedbackInput = z.infer<typeof CustomerFeedbackSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;
