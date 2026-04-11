# SecureStay Git Cleanup TODO - Step 1 Complete

## Plan: Remove large tracked binaries from Git (k8s/kubectl, k8s/minikube-linux-amd64), commit, push to origin/lasindu

**Approved by user: Proceed without scripts to enable push of all current code to https://github.com/nimeshayasith/SecureStay.git (branch lasindu).**

### Steps:
- [x] Step 1: Remove binaries from Git index (keep local): `git rm --cached k8s/kubectl k8s/minikube-linux-amd64` → Already untracked (git rm failed: no match; ls-files confirms absent).
- [ ] Step 2: Commit removal: `git add .gitignore && git commit -m "Remove large local k8s binaries (kubectl/minikube); enforce .gitignore"`
- [ ] Step 3: Push to origin/lasindu: `git push -u origin lasindu`
- [ ] Step 4: Verify: `git status` (clean), `git ls-files --others --exclude-standard | grep k8s` (shows ignored)

**Post-completion:** Repo clean for unlimited pushes. Mark complete in TODO.md.

**Next:** Run Step 2 commit (even if no changes, to sync .gitignore/remote).
