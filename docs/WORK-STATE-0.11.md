# 0.11 checkpoint
Base: 9c25894714cd20089632638f6e03eaa13246227e; feature/marketplace-business-delivery.
- [x] Product-specific BOGO schema, pricing, validation, public filtering.
- [x] Address coordinate validation and owner-scoped editing.
- [x] Customer map pin, reverse geocoding, discovery refresh.
- [x] Homepage BOGO row and zero optional breakdown lines.
- [ ] Regression tests, migration verification, mobile CI.
- [ ] Commit and verify GitHub builds; provide upgrade commands.
No production data modified. Native geocoding; no public Nominatim proxy.

Published feature commit: c73f4f0d9a0a44ef570e7bba978d09b3f5995c26.
Local integration/migration tests (40) and API/admin typechecks passed.
First Customer CI analyzer passed; two new widget tests need gesture debounce/viewport synchronization. Existing six UX tests and zero-breakdown/BOGO row test passed.
Follow-up preserves checkout pin label/default and starts a store on an eligible delivery branch.
