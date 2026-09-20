#!/usr/bin/env python3
"""Check implementation evidence; this is not a substitute for runtime acceptance."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
checks = {
    'merchant_application': [('apps/api/src/routes/merchant-lifecycle.ts', '/v1/merchant/applications/:id/submit'), ('apps/admin-web/app/merchant/register/page.tsx', 'openingHours')],
    'admin_approval': [('apps/api/src/routes/merchant-lifecycle.ts', '/v1/admin/merchant-applications/:id/review'), ('apps/admin-web/app/business-operations/application-review.tsx', 'APPROVE')],
    'staff_rbac': [('apps/api/src/lib/tenant.ts', 'KITCHEN_CREW'), ('apps/admin-web/app/merchant/staff-settings.tsx', 'MANAGER')],
    'tax_and_item_promotions': [('apps/api/src/lib/checkout.ts', 'allocateDiscount'), ('apps/api/src/routes/promotions.ts', 'productId'), ('apps/customer-mobile/lib/screens/checkout_screen.dart', "'taxLabel'")],
    'cooking_notes': [('apps/api/src/routes/orders.ts', 'cookingInstructions'), ('apps/merchant-mobile/lib/main.dart', 'cookingInstructions')],
    'customer_safe_insets': [('apps/customer-mobile/lib/screens/merchant_screen.dart', 'SafeArea(')],
    'driver_actual_settlements': [('apps/api/src/routes/driver-settlements.ts', 'settledPayout'), ('apps/driver-mobile/lib/earnings_sheet.dart', 'No historical pay record')],
    'live_tracking': [('packages/mobile_common/lib/delivery_map.dart', 'FlutterMap'), ('apps/api/src/routes/driver.ts', 'latitude')],
    'delivery_pin': [('apps/api/src/routes/driver.ts', 'deliveryPin')],
    'commercial_documents': [('apps/api/src/lib/documents.ts', 'CUSTOMER_RECEIPT'), ('apps/api/src/routes/documents.ts', 'commission-balances')],
    'merchant_payment_routing': [('apps/api/src/routes/payments.ts', 'transaction_charge:0'), ('apps/api/src/lib/finance.ts', 'MERCHANT_DIRECT')],
    'upgrade_and_build': [('scripts/upgrade-0.8.sh', 'pg_dump'), ('scripts/build-android.sh', 'flutter build')],
}
report = []
for name, references in checks.items():
    evidence = [{'path': path, 'signature': text, 'present': (root/path).is_file() and text in (root/path).read_text()} for path, text in references]
    report.append({'feature': name, 'implementation_evidence_present': all(e['present'] for e in evidence), 'evidence': evidence})
print(json.dumps({'scope': 'Source presence only; see RELEASE-0.8.md for verification and remaining gaps', 'features': report}, indent=2))
raise SystemExit(0 if all(r['implementation_evidence_present'] for r in report) else 1)
