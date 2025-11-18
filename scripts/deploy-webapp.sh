#!/bin/bash
# Script pour déployer la webapp vers EC2

set -e

# Configuration
EC2_HOST="10.0.2.71"
EC2_USER="ec2-user"
EC2_KEY="$HOME/.ssh/mykey-mysql.pem"
REMOTE_DIR="~/face-webapp"
LOCAL_DIR="$(cd "$(dirname "$0")/../webapp" && pwd)"

echo "🚀 Déploiement de la webapp vers EC2..."
echo "📍 Instance: ${EC2_USER}@${EC2_HOST}"
echo "📂 Dossier local: ${LOCAL_DIR}"
echo "📂 Dossier distant: ${REMOTE_DIR}"
echo ""

# Vérifier que la clé existe
if [ ! -f "$EC2_KEY" ]; then
    echo "❌ Clé SSH introuvable: $EC2_KEY"
    echo "💡 Utilisez le chemin complet de votre clé PEM"
    exit 1
fi

# Vérifier que le dossier local existe
if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ Dossier local introuvable: $LOCAL_DIR"
    exit 1
fi

echo "📦 Copie des fichiers..."
rsync -avz -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.DS_Store' \
    --exclude '*.log' \
    --exclude 'tests' \
    "$LOCAL_DIR/" "${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/"

echo ""
echo "✅ Fichiers copiés avec succès!"
echo ""
echo "📋 Commandes à exécuter sur EC2:"
echo "   ssh -i $EC2_KEY ${EC2_USER}@${EC2_HOST}"
echo "   cd ${REMOTE_DIR}"
echo "   npm install"
echo "   node app.js"
echo ""

