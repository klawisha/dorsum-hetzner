#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$(id -u)" = 0 ]] || { echo "Run as root or with sudo."; exit 1; }
source /etc/os-release
[[ "$ID" = ubuntu && "$VERSION_ID" = 24.04 ]] || { echo "This installer targets a fresh Ubuntu 24.04 server."; exit 1; }
apt-get update
apt-get install -y ca-certificates curl python3 unzip age rsync fail2ban unattended-upgrades
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
arch=$(dpkg --print-architecture)
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $VERSION_CODENAME
Components: stable
Architectures: $arch
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
timedatectl set-timezone Europe/Kyiv
systemctl enable --now docker fail2ban
systemctl enable unattended-upgrades
docker version
docker compose version
echo "Host packages installed. Configure Hetzner Firewall and test a non-root SSH login before disabling root/password logins."
