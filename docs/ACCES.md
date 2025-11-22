# Guide d'accès à l'application

## 🌐 Accès Local (pour développement)

### Démarrer l'application localement

```bash
cd /Users/a/aws-face-recognition
./scripts/start-webapp.sh
```

Ou manuellement:
```bash
cd webapp
PORT=3000 DB_HOST=localhost DB_USER=mydbuser DB_PASSWORD=MySecurePassword123! DB_NAME=faces_db \
BUCKET_NAME=myfaces-uploads-ayoub2025 AWS_REGION=us-east-1 ENABLE_PUBLIC_PHOTO_PREVIEW=false npm start
```

### Liens locaux disponibles

- **Page d'accueil**: http://localhost:3000/
- **Formulaire d'upload**: http://localhost:3000/upload
- **Liste des visages**: http://localhost:3000/faces
- **API JSON**: http://localhost:3000/api/faces
- **Health check**: http://localhost:3000/healthz

⚠️ **Note**: Ces liens fonctionnent uniquement sur votre machine locale.

---

## ☁️ Accès AWS EC2 (Production)

### Architecture

- **Bastion (Public)**: `3.231.197.39` (10.0.1.209)
- **Webapp (Private)**: `10.0.2.71` (dans le VPC privé)

### Option 1: SSH Tunnel (Recommandé pour partager)

Créer un tunnel SSH pour exposer l'application localement:

```bash
# Depuis votre Mac local
ssh -i ~/.ssh/mykey-mysql.pem -L 3000:10.0.2.71:3000 ec2-user@3.231.197.39

# Garder ce terminal ouvert, puis dans un autre terminal:
# L'application sera accessible sur http://localhost:3000
```

**Lien à partager**: http://localhost:3000 (fonctionne tant que le tunnel est actif)

### Option 2: Accès direct via Bastion (si configuré)

Si un load balancer ou un reverse proxy est configuré:
- URL publique via le bastion (si configuré)

### Option 3: Exposer via ngrok (pour partager temporairement)

```bash
# Sur l'instance EC2 (10.0.2.71)
# Installer ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Exposer le port 3000
ngrok http 3000

# Vous obtiendrez une URL publique comme:
# https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

---

## 📋 Pour partager avec votre professeur

### Méthode 1: SSH Tunnel (Simple)

1. **Ouvrir un terminal et créer le tunnel**:
```bash
ssh -i ~/.ssh/mykey-mysql.pem -L 3000:10.0.2.71:3000 ec2-user@3.231.197.39
```

2. **Garder ce terminal ouvert**

3. **Lien à partager**: 
   - http://localhost:3000 (si le professeur est sur votre machine)
   - OU utilisez votre IP locale: http://[VOTRE_IP_LOCALE]:3000

4. **Pour obtenir votre IP locale**:
```bash
# Sur Mac
ipconfig getifaddr en0

# Ou
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Méthode 2: ngrok (URL publique temporaire)

1. **Sur l'instance EC2**, installer et démarrer ngrok:
```bash
# Via le bastion
ssh -i ~/.ssh/mykey-mysql.pem ec2-user@3.231.197.39
ssh -i ~/mykey-mysql.pem ec2-user@10.0.2.71
cd ~/face-webapp

# Installer ngrok (une fois)
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Ou télécharger directement
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Exposer l'application
ngrok http 3000
```

2. **Partager l'URL ngrok** (ex: https://xxxx-xx-xx-xx-xx.ngrok-free.app)

### Méthode 3: Accès local réseau

Si vous êtes sur le même réseau que votre professeur:

1. **Démarrer l'application**:
```bash
cd /Users/a/aws-face-recognition/webapp
PORT=3000 DB_HOST=localhost DB_USER=mydbuser DB_PASSWORD=MySecurePassword123! DB_NAME=faces_db \
BUCKET_NAME=myfaces-uploads-ayoub2025 AWS_REGION=us-east-1 ENABLE_PUBLIC_PHOTO_PREVIEW=false node app.js
```

2. **Trouver votre IP locale**:
```bash
ipconfig getifaddr en0
```

3. **Lien à partager**: http://[VOTRE_IP]:3000

⚠️ **Important**: Assurez-vous que le pare-feu autorise les connexions entrantes sur le port 3000.

---

## ✅ Vérification rapide

```bash
# Vérifier que l'application tourne
curl http://localhost:3000/healthz

# Devrait retourner:
# {"status":"ok","db":"reachable","bucket":"myfaces-uploads-ayoub2025","region":"us-east-1"}
```

---

## 🔗 Liens utiles

- **Dépôt GitHub**: https://github.com/saghro/aws-face-recognition
- **Documentation**: Voir les fichiers dans `docs/`
- **Scripts**: Voir les scripts dans `scripts/`

