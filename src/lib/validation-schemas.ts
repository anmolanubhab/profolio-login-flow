import { z } from 'zod';

// Reusable validation patterns
const safeUrlSchema = z.string()
  .trim()
  .refine(
    (url) => {
      if (!url) return true;
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'URL must be a valid http or https link' }
  )
  .optional()
  .or(z.literal(''));

const phoneSchema = z.string()
  .trim()
  .refine(
    (phone) => {
      if (!phone) return true;
      // Allow common phone formats
      return /^[\d\s\-+()]{7,20}$/.test(phone);
    },
    { message: 'Please enter a valid phone number' }
  )
  .optional()
  .or(z.literal(''));

// Profile validation schema
export const profileSchema = z.object({
  display_name: z.string()
    .trim()
    .max(100, 'Name must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  bio: z.string()
    .trim()
    .max(500, 'Bio must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  profession: z.string()
    .trim()
    .max(100, 'Profession must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  location: z.string()
    .trim()
    .max(100, 'Location must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  phone: phoneSchema,
  website: safeUrlSchema,
  profile_visibility: z.enum(['public', 'connections_only', 'private']).optional(),
});

// Job posting validation schema
export const jobSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Job title is required')
    .max(200, 'Title must be less than 200 characters'),
  company_id: z.string().optional().or(z.literal('')),
  company_name: z.string()
    .trim()
    .max(200, 'Company name must be less than 200 characters')
    .optional()
    .or(z.literal('')),
  description: z.string()
    .trim()
    .min(1, 'Job description is required')
    .max(10000, 'Description must be less than 10,000 characters'),
  requirements: z.string()
    .trim()
    .max(10000, 'Requirements must be less than 10,000 characters')
    .optional()
    .or(z.literal('')),
  location: z.string()
    .trim()
    .min(1, 'Location is required')
    .max(200, 'Location must be less than 200 characters'),
  employment_type: z.enum(['full-time', 'part-time', 'contract', 'internship']),
  remote_option: z.enum(['on-site', 'remote', 'hybrid']),
  apply_link: safeUrlSchema,
  salary_min: z.string()
    .refine(
      (val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 100000000;
      },
      { message: 'Salary must be a valid positive number' }
    )
    .optional()
    .or(z.literal('')),
  salary_max: z.string()
    .refine(
      (val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 100000000;
      },
      { message: 'Salary must be a valid positive number' }
    )
    .optional()
    .or(z.literal('')),
  currency: z.enum(['USD', 'EUR', 'GBP', 'INR']),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
export type JobFormData = z.infer<typeof jobSchema>;
