#!/bin/bash
# Script pour démarrer la webapp localement

set -e

cd "$(dirname "$0")/../webapp"

echo "🚀 Démarrage de la webapp..."
echo ""

# Vérifier que les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    echo ""
fi

# Configuration par défaut
export PORT=${PORT:-3000}
export DB_HOST=${DB_HOST:-localhost}
export DB_USER=${DB_USER:-mydbuser}
export DB_PASSWORD=${DB_PASSWORD:-MySecurePassword123!}
export DB_NAME=${DB_NAME:-faces_db}
export BUCKET_NAME=${BUCKET_NAME:-myfaces-uploads-ayoub2025}
export AWS_REGION=${AWS_REGION:-us-east-1}
export ENABLE_PUBLIC_PHOTO_PREVIEW=${ENABLE_PUBLIC_PHOTO_PREVIEW:-false}

echo "✅ Configuration:"
echo "   - Port: $PORT"
echo "   - DB: $DB_NAME @ $DB_HOST"
echo "   - Bucket: $BUCKET_NAME ($AWS_REGION)"
echo ""
echo "🌐 L'application sera disponible sur:"
echo "   - Local: http://localhost:$PORT"
echo "   - Réseau: http://$(hostname -I | awk '{print $1}'):$PORT (si accessible)"
echo ""
echo "🛑 Pour arrêter: Ctrl+C"
echo ""

# Démarrer l'application
node app.js

