import { z } from 'zod';
import { insertScheduleSchema, schedules } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  schedules: {
    list: {
      method: 'GET' as const,
      path: '/api/schedules' as const,
      responses: {
        200: z.array(z.custom<typeof schedules.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/schedules/:id' as const,
      responses: {
        200: z.custom<typeof schedules.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/schedules' as const,
      input: insertScheduleSchema,
      responses: {
        201: z.custom<typeof schedules.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/schedules/:id' as const,
      input: insertScheduleSchema.partial(),
      responses: {
        200: z.custom<typeof schedules.$inferSelect>(),
        404: errorSchemas.notFound,
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/schedules/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
