# 0.10 execution checkpoint

Base: 5ed29c2d76af7361019487ece5dac0cddf875efc
Branch: feature/marketplace-business-delivery

- [x] Runtime configuration endpoint, URL normalization, web origin refresh and mobile observer
- [x] Automatic featured rankings and active-store multi-select override
- [x] Transactional store purge with token revocation and shared-account isolation
- [x] Targeted discount regression validation and feature-gap evidence checklist
- [x] build-apks.sh and update-platform.sh; additive migration and URL-cache refresh
- [x] Local API/web/migration verification; isolated business and origin tests
- [ ] GitHub commit and Android CI analyzer/tests/build verification

Published infrastructure commit: 8cb027319ac963bd248868e7b91ef3eac43e9e1f.
Validate passed. Customer widget checks exposed missing secure-storage mocking; fixed in the 0.10.1 follow-up, which also bounds cache I/O timeouts.
Added user-requested merchant order search with backend isolation and widget race regression tests.
Pending: publish 0.10.1; verify all four CI workflows; download, verify signing and save the three updated APKs; provide platform upgrade commands.

Never execute production purges while implementing or testing. Use temporary databases.
On resumption inspect git status, this file and CI for the branch before continuing.
Credit-reset events cannot wake this session; the checkpoint supports the next active turn.
