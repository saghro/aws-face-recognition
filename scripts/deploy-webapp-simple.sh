#!/bin/bash
# Script simple pour déployer la webapp vers EC2 avec scp

set -e

# Configuration
EC2_HOST="10.0.2.71"
EC2_USER="ec2-user"
EC2_KEY="$HOME/.ssh/mykey-mysql.pem"
REMOTE_DIR="face-webapp"
LOCAL_DIR="$(cd "$(dirname "$0")/../webapp" && pwd)"

echo "🚀 Déploiement de la webapp vers EC2..."
echo "📍 Instance: ${EC2_USER}@${EC2_HOST}"
echo ""

# Vérifier que la clé existe
if [ ! -f "$EC2_KEY" ]; then
    echo "❌ Clé SSH introuvable: $EC2_KEY"
    echo "💡 Cherchez votre clé PEM et mettez à jour EC2_KEY dans le script"
    exit 1
fi

# Vérifier que le dossier local existe
if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ Dossier local introuvable: $LOCAL_DIR"
    exit 1
fi

echo "📦 Copie des fichiers principaux..."

# Copier app.js
echo "  → app.js"
scp -i "$EC2_KEY" -o StrictHostKeyChecking=no \
    "$LOCAL_DIR/app.js" \
    "${EC2_USER}@${EC2_HOST}:~/${REMOTE_DIR}/"

# Copier package.json
echo "  → package.json"
scp -i "$EC2_KEY" -o StrictHostKeyChecking=no \
    "$LOCAL_DIR/package.json" \
    "${EC2_USER}@${EC2_HOST}:~/${REMOTE_DIR}/"

# Copier package-lock.json si existe
if [ -f "$LOCAL_DIR/package-lock.json" ]; then
    echo "  → package-lock.json"
    scp -i "$EC2_KEY" -o StrictHostKeyChecking=no \
        "$LOCAL_DIR/package-lock.json" \
        "${EC2_USER}@${EC2_HOST}:~/${REMOTE_DIR}/"
fi

echo ""
echo "✅ Fichiers copiés avec succès!"
echo ""
echo "📋 Commandes à exécuter sur EC2:"
echo "   ssh -i $EC2_KEY ${EC2_USER}@${EC2_HOST}"
echo "   cd ~/${REMOTE_DIR}"
echo "   npm install"
echo "   PORT=3000 DB_HOST=localhost DB_USER=mydbuser DB_PASSWORD=MySecurePassword123! DB_NAME=faces_db \\"
echo "   BUCKET_NAME=myfaces-uploads-ayoub2025 AWS_REGION=us-east-1 ENABLE_PUBLIC_PHOTO_PREVIEW=false node app.js"
echo ""

