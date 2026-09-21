#!/usr/bin/env python3
"""Check implementation evidence; this is not a substitute for runtime acceptance."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
checks = {
    'binary_onboarding_and_slug': [('apps/api/src/routes/branding.ts', 'limitInputPixels'), ('apps/api/src/lib/merchant-application.ts', 'storeSlug'), ('apps/merchant-mobile/lib/main.dart', "Uri.parse('https://fidalix.com')")],
    'native_store_and_staff': [('apps/merchant-mobile/lib/store_page.dart', 'uploadBranding'), ('apps/merchant-mobile/lib/staff_page.dart', 'Delete staff membership?')],
    'customer_discovery': [('apps/customer-mobile/lib/screens/marketplace_screen.dart', 'Neighborhood Favorites'), ('apps/api/src/routes/marketplace.ts', 'storeVisit.upsert')],
    'root_system_controls': [('apps/api/src/routes/admin-system.ts', 'Preview expired or already used.'), ('apps/admin-web/app/system/page.tsx', 'Master settings')],
    'period_commission': [('apps/api/src/routes/commission-periods.ts', 'Consolidated commission invoice')],

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
    'runtime_routes': [('apps/api/src/lib/public-config.ts', 'normalizeMediaUrls'), ('packages/mobile_common/lib/runtime_config.dart', 'legacyOrigins'), ('apps/admin-web/lib/request-origin.ts', 'hasTrustedRuntimeOrigin')],
    'featured_ranking_and_override': [('apps/api/src/lib/featured-stores.ts', "INTERVAL '30 days'"), ('apps/admin-web/app/system/featured-stores.tsx', 'Matching active stores')],
    'store_purge_isolation': [('apps/api/src/lib/store-purge.ts', 'executeStorePurge'), ('apps/api/src/lib/auth.ts', 'authVersion'), ('tests/upgrade-features-010.mts', '5001')],
    'upgrade_and_build': [('scripts/update-platform.sh', 'pg_dump'), ('scripts/build-apks.sh', 'build-android.sh'), ('scripts/build-android.sh', 'flutter build')],
}
report = []
for name, references in checks.items():
    evidence = [{'path': path, 'signature': text, 'present': (root/path).is_file() and text in (root/path).read_text()} for path, text in references]
    report.append({'feature': name, 'implementation_evidence_present': all(e['present'] for e in evidence), 'evidence': evidence})
# Inventory all tracked and new repository source files; exclude dependencies/build outputs.
import subprocess
paths = subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'], cwd=root).decode().split('\0')
source_paths = sorted({p for p in paths if Path(p).suffix in {'.ts','.tsx','.dart','.prisma','.sql','.py','.sh','.yml'} and (root/p).is_file()})
gaps = [
    {'priority':'P0','feature':'Physical Android/Firebase acceptance','status':'requires_device_verification','evidence':['packages/mobile_common/lib/fida_mobile_common.dart','apps/driver-mobile/lib/main.dart']},
    {'priority':'P0','feature':'Live merchant payment and refund reconciliation','status':'requires_provider_acceptance','evidence':['apps/api/src/routes/payments.ts','apps/api/src/routes/merchant-business.ts']},
    {'priority':'P1','feature':'Shared rate limits and multi-replica load/recovery validation','status':'partial_per_process_limits','evidence':['apps/api/src/server.ts']},
    {'priority':'P1','feature':'Automatic provider refunds and invoice remittance allocation','status':'manual_external_payment_records_only','evidence':['apps/api/src/routes/merchant-business.ts','apps/api/src/routes/commission-periods.ts']},
    {'priority':'P2','feature':'Traffic-aware embedded navigation, dynamic ETA and multi-stop optimization','status':'external_navigation_only','evidence':['packages/mobile_common/lib/delivery_map.dart','apps/driver-mobile/lib/main.dart']},
    {'priority':'P2','feature':'Self-service staff password recovery','status':'not_implemented','evidence':['apps/api/src/routes/auth.ts','apps/merchant-mobile/lib/staff_page.dart']},
    {'priority':'P3','feature':'SMS/social login, subscriptions and conversion analytics','status':'not_implemented','evidence':['apps/api/src/routes/auth.ts','apps/api/src/routes/marketplace.ts']},
]
print(json.dumps({'scope': 'Source evidence only; RELEASE-0.10.md records tested behavior and remaining acceptance. No full marketplace parity claim.', 'source_file_count':len(source_paths), 'features':report, 'remaining':gaps}, indent=2))
raise SystemExit(0 if all(r['implementation_evidence_present'] for r in report) else 1)
