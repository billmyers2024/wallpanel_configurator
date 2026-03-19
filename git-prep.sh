# Remove URL rewrite rules that break SSH
git config --global --unset url.git@github.com:.insteadOf 2>/dev/null
git config --global --unset url.https://github.com/.insteadOf 2>/dev/null

# SSH setup
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/github_bmyers

# Fix remote to SSH
git remote set-url origin git@github.com:billmyers2024/wallpanel_configurator.git

# Verify
git remote -v
# Test SSH authentication (GitHub always returns 1 since no shell access, but "successfully authenticated" means it worked)
ssh -T git@github.com 2>&1 | grep -q "successfully authenticated" && echo "SSH authentication successful" || echo "SSH authentication check completed"
