# Déploiement de la Webapp vers EC2

## Méthode 1 : Utiliser le script de déploiement (Recommandé)

```bash
# Depuis votre machine locale
cd /Users/a/aws-face-recognition
./scripts/deploy-webapp.sh
```

Puis sur l'instance EC2 :
```bash
ssh -i ~/.ssh/mykey-mysql.pem ec2-user@10.0.2.71
cd ~/face-webapp
npm install
PORT=3000 DB_HOST=localhost DB_USER=mydbuser DB_PASSWORD=MySecurePassword123! DB_NAME=faces_db \
BUCKET_NAME=myfaces-uploads-ayoub2025 AWS_REGION=us-east-1 ENABLE_PUBLIC_PHOTO_PREVIEW=false node app.js
```

## Méthode 2 : Copie manuelle avec scp

```bash
# Depuis votre machine locale (Mac)
cd ~/aws-face-recognition/webapp

# Copier les fichiers vers EC2
scp -i ~/.ssh/mykey-mysql.pem -r \
    --exclude 'node_modules' \
    --exclude '.DS_Store' \
    --exclude 'tests' \
    app.js package.json package-lock.json \
    ec2-user@10.0.2.71:~/face-webapp/
```

## Méthode 3 : Depuis une instance EC2 intermédiaire

Si vous êtes connecté depuis une autre instance EC2 :

```bash
# Sur l'instance EC2 source (10.0.1.209)
cd ~/aws-face-recognition/webapp

# Copier vers l'instance cible
scp -i ~/mykey-mysql.pem -r \
    app.js package.json package-lock.json \
    ec2-user@10.0.2.71:~/face-webapp/
```

## Variables d'environnement nécessaires

Sur l'instance EC2, configurez ces variables :

```bash
export PORT=3000
export DB_HOST=localhost
export DB_USER=mydbuser
export DB_PASSWORD=MySecurePassword123!
export DB_NAME=faces_db
export BUCKET_NAME=myfaces-uploads-ayoub2025
export AWS_REGION=us-east-1
export ENABLE_PUBLIC_PHOTO_PREVIEW=false
```

## Exécution en arrière-plan

Pour faire tourner l'application en arrière-plan :

```bash
# Utiliser nohup
nohup node app.js > app.log 2>&1 &

# Ou utiliser screen
screen -S webapp
node app.js
# Ctrl+A puis D pour détacher

# Pour réattacher plus tard
screen -r webapp
```

## Vérification

```bash
# Vérifier que le serveur écoute
curl http://localhost:3000/healthz

# Vérifier les logs
tail -f app.log
```

