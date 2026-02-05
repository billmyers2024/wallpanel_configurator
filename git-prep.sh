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
ssh -T git@github.com
