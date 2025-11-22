# 🔗 Liens d'accès à l'application

## ✅ Application en cours d'exécution

L'application est démarrée et accessible aux adresses suivantes:

### 📍 Accès Local (depuis votre machine)

- **Page d'accueil**: http://localhost:3000/
- **Formulaire d'upload**: http://localhost:3000/upload
- **Liste des visages**: http://localhost:3000/faces
- **API JSON**: http://localhost:3000/api/faces
- **Health check**: http://localhost:3000/healthz

### 🌐 Accès Réseau Local (même WiFi)

Si votre professeur est sur le même réseau Wi‑Fi:

- **Page d'accueil**: http://192.168.1.4:3000/
- **Formulaire d'upload**: http://192.168.1.4:3000/upload
- **Liste des visages**: http://192.168.1.4:3000/faces

⚠️ **Important**: Votre pare-feu doit autoriser les connexions sur le port 3000.

---

## ☁️ Accès AWS EC2 (Production)

### Architecture
- **Bastion**: `3.231.197.39` (10.0.1.209) - IP publique
- **Webapp**: `10.0.2.71` - IP privée dans le VPC

### Option 1: SSH Tunnel (pour partager)

Pour exposer l'application AWS via votre machine:

```bash
# Terminal 1: Créer le tunnel SSH
ssh -i ~/.ssh/mykey-mysql.pem -L 3001:10.0.2.71:3000 ec2-user@3.231.197.39

# Terminal 2: L'application AWS sera accessible sur:
# http://localhost:3001
```

**Lien à partager**: http://localhost:3001 ou http://192.168.1.4:3001

### Option 2: ngrok (URL publique temporaire)

Sur l'instance EC2:

```bash
# Se connecter à EC2
ssh -i ~/.ssh/mykey-mysql.pem ec2-user@3.231.197.39
ssh -i ~/mykey-mysql.pem ec2-user@10.0.2.71

# Installer ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Exposer le port 3000
ngrok http 3000
```

**Lien à partager**: L'URL ngrok générée (ex: https://xxxx.ngrok-free.app)

---

## 📋 Liens GitHub

- **Dépôt**: https://github.com/saghro/aws-face-recognition
- **Documentation**: https://github.com/saghro/aws-face-recognition/tree/main/docs

---

## 🔧 Commandes utiles

### Arrêter l'application
```bash
kill $(cat /tmp/webapp.pid)
```

### Redémarrer l'application
```bash
cd /Users/a/aws-face-recognition/webapp
PORT=3000 DB_HOST=localhost DB_USER=mydbuser DB_PASSWORD=MySecurePassword123! DB_NAME=faces_db \
BUCKET_NAME=myfaces-uploads-ayoub2025 AWS_REGION=us-east-1 ENABLE_PUBLIC_PHOTO_PREVIEW=false \
node app.js > /tmp/webapp-start.log 2>&1 &
echo $! > /tmp/webapp.pid
```

### Voir les logs
```bash
tail -f /tmp/webapp-start.log
```

---

## ✅ Vérification

```bash
# Tester l'accès
curl http://localhost:3000/healthz

# Devrait retourner:
# {"status":"ok","db":"reachable","bucket":"myfaces-uploads-ayoub2025","region":"us-east-1"}
```

