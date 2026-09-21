import type { MembershipRole, TenantStatus } from '@fida/database/client';

export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  isPlatformAdmin: boolean;
};

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  tenantStatus: TenantStatus;
  role: MembershipRole;
  branchId: string | null;
};

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
    tenantContext?: TenantContext;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      type: 'access';
      authVersion?: number;
      isPlatformAdmin: boolean;
    };
    user: {
      sub: string;
      type: 'access';
      authVersion?: number;
      isPlatformAdmin: boolean;
    };
  }
}
