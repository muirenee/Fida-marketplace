// Generated from schema.prisma by scripts/generate-admin-catalog.mjs.
export type CatalogField={name:string;type:string;kind:string;isId:boolean;isRequired:boolean;isList:boolean;relationFromFields:string[];relationToFields:string[]};
export type CatalogModel={name:string;dbName:string|null;primaryKey:{fields:string[]}|null;fields:CatalogField[]};
export const catalog:{models:CatalogModel[];enums:{name:string;values:{name:string}[]}[]}={
  "models": [
    {
      "name": "Tenant",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "paymentSubaccount",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "legalName",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "taxId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "logoUrl",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "coverUrl",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "cuisineTags",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "taxLabel",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "name",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "slug",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "status",
          "type": "TenantStatus",
          "kind": "enum",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "merchantType",
          "type": "MerchantType",
          "kind": "enum",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "currency",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "timezone",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isAcceptingOrders",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "minimumOrder",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "defaultDeliveryFee",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "serviceFeePercent",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "platformCommissionPercent",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "activatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "taxPercent",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "branches",
          "type": "Branch",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "memberships",
          "type": "TenantMembership",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "categories",
          "type": "Category",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "products",
          "type": "Product",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orders",
          "type": "Order",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveryOperator",
          "type": "DeliveryOperator",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "User",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "authVersion",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "email",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "phone",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "passwordHash",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "firstName",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "lastName",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isActive",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isPlatformAdmin",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "emailVerifiedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "phoneVerifiedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "lastLoginAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "memberships",
          "type": "TenantMembership",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "customerOrders",
          "type": "Order",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "addresses",
          "type": "CustomerAddress",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "driver",
          "type": "Driver",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "sessions",
          "type": "Session",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "Session",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "userId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tokenHash",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "expiresAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "revokedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "user",
          "type": "User",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "userId"
          ],
          "relationToFields": [
            "id"
          ]
        }
      ]
    },
    {
      "name": "TenantMembership",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "isActive",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "userId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "branchId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "role",
          "type": "MembershipRole",
          "kind": "enum",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenant",
          "type": "Tenant",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "tenantId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "user",
          "type": "User",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "userId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "branch",
          "type": "Branch",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [
            "branchId"
          ],
          "relationToFields": [
            "id"
          ]
        }
      ]
    },
    {
      "name": "Branch",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "name",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "code",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "addressLine",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "city",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "latitude",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "longitude",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isActive",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isAcceptingOrders",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "pickupEnabled",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveryEnabled",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "logisticsMode",
          "type": "LogisticsMode",
          "kind": "enum",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "openingHours",
          "type": "Json",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "closedUntil",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenant",
          "type": "Tenant",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "tenantId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "memberships",
          "type": "TenantMembership",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orders",
          "type": "Order",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveryZones",
          "type": "DeliveryZone",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "drivers",
          "type": "Driver",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "DeliveryZone",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "branchId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "minDistanceKm",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "maxDistanceKm",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "fee",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isActive",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "branch",
          "type": "Branch",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "branchId"
          ],
          "relationToFields": [
            "id"
          ]
        }
      ]
    },
    {
      "name": "Category",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "name",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "slug",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "sortOrder",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deletedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isActive",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenant",
          "type": "Tenant",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "tenantId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "products",
          "type": "Product",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "Product",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "categoryId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "name",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "description",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "imageUrl",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "options",
          "type": "Json",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deletedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "sku",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "price",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isActive",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isAvailable",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenant",
          "type": "Tenant",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "tenantId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "category",
          "type": "Category",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [
            "categoryId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "items",
          "type": "OrderItem",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "CustomerAddress",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "userId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "label",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "addressLine",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "city",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "latitude",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "longitude",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "instructions",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isDefault",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "user",
          "type": "User",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "userId"
          ],
          "relationToFields": [
            "id"
          ]
        }
      ]
    },
    {
      "name": "Order",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "cookingInstructions",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "taxLabel",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orderNumber",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "scheduledFor",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveryPin",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tax",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "promoCode",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "checkoutKey",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "branchId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "customerId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "status",
          "type": "OrderStatus",
          "kind": "enum",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "fulfillmentType",
          "type": "FulfillmentType",
          "kind": "enum",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "paymentMethod",
          "type": "PaymentMethod",
          "kind": "enum",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "paymentStatus",
          "type": "PaymentStatus",
          "kind": "enum",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "subtotal",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveryFee",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "serviceFee",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "discount",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "total",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "platformCommissionPercent",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "platformCommissionAmount",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveryDistanceKm",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveryAddress",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveryLatitude",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveryLongitude",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveryInstructions",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenant",
          "type": "Tenant",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "tenantId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "branch",
          "type": "Branch",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "branchId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "customer",
          "type": "User",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "customerId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "items",
          "type": "OrderItem",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "delivery",
          "type": "Delivery",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "OrderItem",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "discount",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tax",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orderId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "productId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "productName",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "quantity",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "unitPrice",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "totalPrice",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "order",
          "type": "Order",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "orderId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "product",
          "type": "Product",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [
            "productId"
          ],
          "relationToFields": [
            "id"
          ]
        }
      ]
    },
    {
      "name": "DeliveryOperator",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "driverBasePay",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "driverPerKmPay",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "type",
          "type": "DeliveryOperatorType",
          "kind": "enum",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "name",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isActive",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenant",
          "type": "Tenant",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [
            "tenantId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "drivers",
          "type": "Driver",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveries",
          "type": "Delivery",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "Driver",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "userId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "operatorId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "branchId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "displayName",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "vehiclePlate",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "vehicleType",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "maxConcurrentOrders",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isActive",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isOnline",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isAvailable",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "latitude",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "longitude",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "lastSeenAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "user",
          "type": "User",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "userId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "operator",
          "type": "DeliveryOperator",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [
            "operatorId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "branch",
          "type": "Branch",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [
            "branchId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "deliveries",
          "type": "Delivery",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": true,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "Delivery",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "settledPayout",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "settlementReference",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "settledAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "estimatedPayout",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "payoutCurrency",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orderId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "driverId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "operatorId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "status",
          "type": "DeliveryStatus",
          "kind": "enum",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "assignedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "pickedUpAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "deliveredAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "order",
          "type": "Order",
          "kind": "object",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [
            "orderId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "driver",
          "type": "Driver",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [
            "driverId"
          ],
          "relationToFields": [
            "id"
          ]
        },
        {
          "name": "operator",
          "type": "DeliveryOperator",
          "kind": "object",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [
            "operatorId"
          ],
          "relationToFields": [
            "id"
          ]
        }
      ]
    },
    {
      "name": "AdminAuditEvent",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "actorUserId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "actorEmail",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "method",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "route",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "path",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "action",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "targetType",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "targetId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "statusCode",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "success",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "changes",
          "type": "Json",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "metadata",
          "type": "Json",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "ipAddress",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "userAgent",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "DeviceToken",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "userId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "token",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "app",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "NotificationEvent",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "eventKey",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orderId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "status",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "attempts",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "sentAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "nextAttemptAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "Favorite",
      "dbName": null,
      "primaryKey": {
        "fields": [
          "userId",
          "tenantId"
        ]
      },
      "fields": [
        {
          "name": "userId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "Review",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orderId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "customerId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "rating",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "comment",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "SupportCase",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orderId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "userId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "subject",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "description",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "status",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "resolution",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "Promotion",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "productId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "discountType",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "flatAmount",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "stackable",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "code",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "percent",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "minimumOrder",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "maxDiscount",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "maxUses",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "usedCount",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "isActive",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "expiresAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "PaymentAttempt",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "settlementMode",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "destinationSubaccount",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orderId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "customerId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "reference",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "provider",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "status",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "checkoutUrl",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "providerTransactionId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "FinanceEntry",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orderId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "kind",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "amount",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "reference",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "note",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "actorId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "RefundRequest",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orderId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "customerId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "amount",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "reason",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "status",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "resolution",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "externalReference",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "BusinessDocument",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "number",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "kind",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "orderId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "customerId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "payload",
          "type": "Json",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "issuedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "MerchantApplication",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "ownerId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "status",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "step",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "payload",
          "type": "Json",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "reviewReason",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "reviewedBy",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "reviewedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "PromotionPolicy",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "maxPercent",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "maxDiscount",
          "type": "Decimal",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "allowStacking",
          "type": "Boolean",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "MediaAsset",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "ownerId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "url",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "bytes",
          "type": "Int",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "RuntimeSettings",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "values",
          "type": "Json",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "updatedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "AdminAction",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "actorId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tokenHash",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "payload",
          "type": "Json",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "expiresAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "usedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": false,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "CommissionPeriod",
      "dbName": null,
      "primaryKey": null,
      "fields": [
        {
          "name": "id",
          "type": "String",
          "kind": "scalar",
          "isId": true,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "from",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "until",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "number",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "payload",
          "type": "Json",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdBy",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    },
    {
      "name": "StoreVisit",
      "dbName": null,
      "primaryKey": {
        "fields": [
          "userId",
          "tenantId"
        ]
      },
      "fields": [
        {
          "name": "userId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "tenantId",
          "type": "String",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        },
        {
          "name": "visitedAt",
          "type": "DateTime",
          "kind": "scalar",
          "isId": false,
          "isRequired": true,
          "isList": false,
          "relationFromFields": [],
          "relationToFields": []
        }
      ]
    }
  ],
  "enums": [
    {
      "name": "TenantStatus",
      "values": [
        {
          "name": "PENDING"
        },
        {
          "name": "PENDING_APPROVAL"
        },
        {
          "name": "REJECTED"
        },
        {
          "name": "ACTIVE"
        },
        {
          "name": "SUSPENDED"
        },
        {
          "name": "CLOSED"
        }
      ]
    },
    {
      "name": "MembershipRole",
      "values": [
        {
          "name": "OWNER"
        },
        {
          "name": "ADMIN"
        },
        {
          "name": "MANAGER"
        },
        {
          "name": "STAFF"
        },
        {
          "name": "KITCHEN_CREW"
        }
      ]
    },
    {
      "name": "MerchantType",
      "values": [
        {
          "name": "RESTAURANT"
        },
        {
          "name": "SUPERMARKET"
        },
        {
          "name": "PHARMACY"
        },
        {
          "name": "RETAIL"
        },
        {
          "name": "OTHER"
        }
      ]
    },
    {
      "name": "OrderStatus",
      "values": [
        {
          "name": "PENDING"
        },
        {
          "name": "ACCEPTED"
        },
        {
          "name": "PREPARING"
        },
        {
          "name": "READY_FOR_PICKUP"
        },
        {
          "name": "PICKED_UP"
        },
        {
          "name": "DELIVERING"
        },
        {
          "name": "COMPLETED"
        },
        {
          "name": "CANCELLED"
        },
        {
          "name": "REJECTED"
        }
      ]
    },
    {
      "name": "FulfillmentType",
      "values": [
        {
          "name": "PICKUP"
        },
        {
          "name": "DELIVERY"
        }
      ]
    },
    {
      "name": "LogisticsMode",
      "values": [
        {
          "name": "MERCHANT"
        },
        {
          "name": "FIDA"
        },
        {
          "name": "HYBRID"
        }
      ]
    },
    {
      "name": "DeliveryOperatorType",
      "values": [
        {
          "name": "MERCHANT"
        },
        {
          "name": "FIDA"
        }
      ]
    },
    {
      "name": "DeliveryStatus",
      "values": [
        {
          "name": "UNASSIGNED"
        },
        {
          "name": "OFFERED"
        },
        {
          "name": "ASSIGNED"
        },
        {
          "name": "AT_PICKUP"
        },
        {
          "name": "PICKED_UP"
        },
        {
          "name": "AT_DROPOFF"
        },
        {
          "name": "DELIVERED"
        },
        {
          "name": "CANCELLED"
        }
      ]
    },
    {
      "name": "PaymentMethod",
      "values": [
        {
          "name": "CASH"
        },
        {
          "name": "MOBILE_MONEY"
        },
        {
          "name": "CARD"
        },
        {
          "name": "WALLET"
        }
      ]
    },
    {
      "name": "PaymentStatus",
      "values": [
        {
          "name": "PENDING"
        },
        {
          "name": "AUTHORIZED"
        },
        {
          "name": "PAID"
        },
        {
          "name": "FAILED"
        },
        {
          "name": "REFUNDED"
        },
        {
          "name": "PARTIALLY_REFUNDED"
        }
      ]
    }
  ]
};
