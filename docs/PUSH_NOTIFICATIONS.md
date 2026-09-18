# Fida Marketplace Push Notifications

Fida uses Firebase Cloud Messaging (FCM) for customer, merchant and driver push notifications.

## Notification flow

- Customer places an order -> merchant users receive a **New order** notification.
- Merchant accepts, prepares, rejects or marks an order ready -> customer receives an order-status notification.
- A delivery order becomes ready for pickup -> eligible online/available drivers receive a **Delivery available** notification.
- A driver claims the delivery -> customer receives a **Driver assigned** notification.
- Driver pickup, approach and delivery status changes -> customer receives progress notifications.
- Customer cancels before preparation -> merchant users receive an **Order cancelled** notification.

The API stores device tokens per Fida user and app. Invalid FCM tokens are automatically disabled. Logout unregisters the current app token.

## Firebase project

Use one Firebase project for Fida Marketplace and add these Android applications:

- Customer: `com.fidalix.marketplace.customer_mobile`
- Merchant: `com.fidalix.marketplace.merchant_mobile`
- Driver: `com.fidalix.marketplace.driver_mobile`

The mobile builds initialize Firebase from compile-time values, so `google-services.json` is not committed to the repository.

## GitHub Actions secrets

Configure these repository secrets without committing or pasting their values into source code:

- `FIDA_FIREBASE_PROJECT_ID`
- `FIDA_FIREBASE_MESSAGING_SENDER_ID`
- `FIDA_FIREBASE_CUSTOMER_API_KEY`
- `FIDA_FIREBASE_CUSTOMER_APP_ID`
- `FIDA_FIREBASE_MERCHANT_API_KEY`
- `FIDA_FIREBASE_MERCHANT_APP_ID`
- `FIDA_FIREBASE_DRIVER_API_KEY`
- `FIDA_FIREBASE_DRIVER_APP_ID`

If these secrets are absent, the APK still builds but push registration remains disabled.

## API service account

Create a Firebase/Google Cloud service account that can send Firebase Cloud Messaging messages. Base64-encode the complete service-account JSON and set it only on the production API server:

```text
FIDA_FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=<base64 service-account JSON>
PUSH_WORKER_INTERVAL_MS=5000
```

Do not commit the service-account JSON or its base64 value.

If the server credential is absent, the API continues operating normally and safely skips FCM delivery.

## Database

Push support adds:

- `PushDevice` for registered customer/merchant/driver FCM tokens.
- `PushOrderState` for durable order/delivery notification state.
- `Delivery.createdAt` and `Delivery.updatedAt` timestamps so delivery-only changes can be detected.

Run `pnpm db:push` during deployment after taking a PostgreSQL backup.

## Production verification

After deployment and installing Firebase-configured APKs, sign in once to each app and verify:

1. A new customer order notifies the merchant app while it is in the background.
2. Merchant order-state changes notify the customer app.
3. A delivery becoming ready notifies an eligible online/available driver.
4. Driver assignment and delivery progress notify the customer.
5. Customer cancellation notifies the merchant.
6. Logout deactivates the app's registered token.

Background and terminated-app notifications are delivered by the Android FCM notification channel. Foreground apps continue to refresh their normal screens; an explicit in-app foreground banner can be added later if required.
