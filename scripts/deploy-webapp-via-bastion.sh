#!/bin/bash
# Script pour déployer via une instance bastion (IP privée)

set -e

# Configuration
BASTION_HOST="3.231.197.39"
BASTION_USER="ec2-user"
BASTION_KEY="$HOME/.ssh/mykey-mysql.pem"

TARGET_HOST="10.0.2.71"
TARGET_USER="ec2-user"
TARGET_KEY="~/mykey-mysql.pem"

LOCAL_DIR="$(cd "$(dirname "$0")/../webapp" && pwd)"
REMOTE_DIR="face-webapp"

echo "🚀 Déploiement de la webapp via bastion..."
echo "📍 Bastion: ${BASTION_USER}@${BASTION_HOST}"
echo "📍 Cible: ${TARGET_USER}@${TARGET_HOST}"
echo ""

# Vérifier que la clé existe
if [ ! -f "$BASTION_KEY" ]; then
    echo "❌ Clé SSH introuvable: $BASTION_KEY"
    exit 1
fi

# Étape 1: Copier les fichiers vers le bastion
echo "📦 Étape 1/2: Copie vers le bastion..."
scp -i "$BASTION_KEY" -o StrictHostKeyChecking=no \
    "$LOCAL_DIR/app.js" \
    "$LOCAL_DIR/package.json" \
    "${BASTION_USER}@${BASTION_HOST}:~/tmp-deploy/"

# Copier package-lock.json si existe
if [ -f "$LOCAL_DIR/package-lock.json" ]; then
    scp -i "$BASTION_KEY" -o StrictHostKeyChecking=no \
        "$LOCAL_DIR/package-lock.json" \
        "${BASTION_USER}@${BASTION_HOST}:~/tmp-deploy/"
fi

echo "✅ Fichiers copiés vers bastion"
echo ""

# Étape 2: Copier du bastion vers la cible
echo "📦 Étape 2/2: Copie du bastion vers la cible..."

ssh -i "$BASTION_KEY" -o StrictHostKeyChecking=no "${BASTION_USER}@${BASTION_HOST}" << EOF
    mkdir -p ~/tmp-deploy
    scp -i ${TARGET_KEY} -o StrictHostKeyChecking=no \
        ~/tmp-deploy/app.js \
        ~/tmp-deploy/package.json \
        ${TARGET_USER}@${TARGET_HOST}:~/${REMOTE_DIR}/
    
    if [ -f ~/tmp-deploy/package-lock.json ]; then
        scp -i ${TARGET_KEY} -o StrictHostKeyChecking=no \
            ~/tmp-deploy/package-lock.json \
            ${TARGET_USER}@${TARGET_HOST}:~/${REMOTE_DIR}/
    fi
    
    rm -rf ~/tmp-deploy
    echo "✅ Déploiement terminé!"
EOF

echo ""
echo "✅ Déploiement réussi!"
echo ""
echo "📋 Commandes à exécuter sur EC2:"
echo "   ssh -i $BASTION_KEY ${BASTION_USER}@${BASTION_HOST}"
echo "   ssh -i ~/mykey-mysql.pem ${TARGET_USER}@${TARGET_HOST}"
echo "   cd ~/${REMOTE_DIR}"
echo "   npm install"
echo "   PORT=3000 DB_HOST=localhost DB_USER=mydbuser DB_PASSWORD=MySecurePassword123! DB_NAME=faces_db \\"
echo "   BUCKET_NAME=myfaces-uploads-ayoub2025 AWS_REGION=us-east-1 ENABLE_PUBLIC_PHOTO_PREVIEW=false node app.js"
echo ""

