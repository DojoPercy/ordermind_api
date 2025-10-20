import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid name'),
  displayName: z.string().min(3).max(100),
});
