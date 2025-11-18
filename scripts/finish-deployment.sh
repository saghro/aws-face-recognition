#!/bin/bash
# Script pour finaliser le déploiement sur EC2

set -e

BASTION_HOST="3.231.197.39"
BASTION_USER="ec2-user"
BASTION_KEY="$HOME/.ssh/mykey-mysql.pem"

TARGET_HOST="10.0.2.71"
TARGET_USER="ec2-user"
TARGET_KEY="~/mykey-mysql.pem"

REMOTE_DIR="face-webapp"

echo "🔧 Finalisation du déploiement sur EC2..."
echo ""

# Exécuter les commandes sur l'instance cible via le bastion
ssh -i "$BASTION_KEY" -o StrictHostKeyChecking=no "${BASTION_USER}@${BASTION_HOST}" << EOF
    echo "🔗 Connexion à l'instance cible..."
    ssh -i ${TARGET_KEY} -o StrictHostKeyChecking=no ${TARGET_USER}@${TARGET_HOST} << 'INNER'
        cd ~/${REMOTE_DIR}
        echo ""
        echo "📦 Installation des dépendances..."
        npm install
        
        echo ""
        echo "🛑 Arrêt de l'ancienne instance (si en cours)..."
        pkill -f "node app.js" || true
        sleep 2
        
        echo ""
        echo "🚀 Démarrage de l'application avec le nouveau design..."
        export PORT=3000
        export DB_HOST=localhost
        export DB_USER=mydbuser
        export DB_PASSWORD=MySecurePassword123!
        export DB_NAME=faces_db
        export BUCKET_NAME=myfaces-uploads-ayoub2025
        export AWS_REGION=us-east-1
        export ENABLE_PUBLIC_PHOTO_PREVIEW=false
        
        nohup node app.js > app.log 2>&1 &
        sleep 2
        
        echo ""
        echo "✅ Application démarrée!"
        echo ""
        echo "📊 Vérification..."
        if curl -s http://localhost:3000/healthz > /dev/null; then
            echo "✅ Serveur opérationnel sur http://10.0.2.71:3000"
        else
            echo "⚠️  Serveur en cours de démarrage..."
        fi
        
        echo ""
        echo "📋 Informations:"
        echo "   - Logs: tail -f ~/${REMOTE_DIR}/app.log"
        echo "   - Arrêter: pkill -f 'node app.js'"
        echo "   - Accès: http://10.0.2.71:3000"
INNER
EOF

echo ""
echo "✅ Déploiement finalisé avec succès!"
echo ""

