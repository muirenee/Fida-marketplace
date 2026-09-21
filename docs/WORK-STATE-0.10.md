# 0.10 execution checkpoint

Base: 5ed29c2d76af7361019487ece5dac0cddf875efc
Branch: feature/marketplace-business-delivery

- [x] Runtime configuration endpoint, URL normalization, web origin refresh and mobile observer
- [x] Automatic featured rankings and active-store multi-select override
- [x] Transactional store purge with token revocation and shared-account isolation
- [x] Targeted discount regression validation and feature-gap evidence checklist
- [x] build-apks.sh and update-platform.sh; additive migration and URL-cache refresh
- [x] Local API/web/migration verification; isolated business and origin tests
- [x] GitHub commit and Android CI analyzer/tests/build verification

Published infrastructure commit: 8cb027319ac963bd248868e7b91ef3eac43e9e1f.
Validate passed. Customer widget checks exposed missing secure-storage mocking; fixed in the 0.10.1 follow-up, which also bounds cache I/O timeouts.
Added user-requested merchant order search with backend isolation and widget race regression tests.
Published 0.10.1: 5fc905b8135f4d3488806dbdb2fdf8feb6e39250.
All four CI workflows passed. Customer, Merchant and Driver signed release APKs uploaded successfully.
CI runs: Customer 35623023886; Merchant 35623024018; Driver 35623023800; Validate 35623023962.
APKs downloaded: archive hashes match GitHub artifact digests; ZIP CRCs pass; package IDs/certificates match 0.9 and version codes increased. APKs are version 0.10.1.
No pending source or build work. Deployment and physical-device acceptance remain with the operator; see RELEASE-0.10.md.

Never execute production purges while implementing or testing. Use temporary databases.
On resumption inspect git status, this file and CI for the branch before continuing.
Credit-reset events cannot wake this session; the checkpoint supports the next active turn.
