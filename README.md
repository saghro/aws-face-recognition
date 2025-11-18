# Face Recognition Lab

Application de laboratoire qui démontre une chaîne complète de reconnaissance faciale basée sur AWS : upload de photos via une interface Express, stockage sur Amazon S3, indexation automatique avec AWS Rekognition déclenchée par AWS Lambda, puis restitution des résultats depuis une base MySQL.

## Aperçu

- **Front-end léger Express** (`webapp/`) avec pages statiques modernes, formulaire d’upload, API JSON et endpoint de santé.
- **Lambda Node.js** (`lambda/`) déclenchée par des notifications S3 pour indexer les visages et écrire dans MySQL à l’aide d’AWS Rekognition.
- **Infrastructure de référence** fournie sous forme de templates et de scripts (`config/`, `scripts/`).
- **Documentation complète** dans `docs/` : architecture, déploiement, FAQ et sécurité.

> Le diagramme d’architecture haute-niveau utilisé dans ce dépôt est stocké dans `docs/architecture.md` (placez l’image `docs/images/architecture.png` si vous souhaitez l’inclure).

## Démarrage rapide (local)

```bash
cd webapp
npm install
PORT=3000 DB_HOST=localhost DB_USER=mydbuser DB_PASSWORD=MySecurePassword123! DB_NAME=faces_db \
BUCKET_NAME=myfaces-uploads-ayoub2025 AWS_REGION=us-east-1 ENABLE_PUBLIC_PHOTO_PREVIEW=false npm start
```

1. Lancez MySQL et appliquez `config/database-schema.sql` (cf. script `scripts/setup-database.sh`).
2. Créez un bucket S3 et activez la notification vers la fonction Lambda (cf. `lambda/` et `docs/deployment.md`).
3. Uploadez un visage via http://localhost:3000/upload et observez le résultat dans http://localhost:3000/faces.

## Variables d’environnement clés

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `PORT` | Port HTTP de l’app Express | `3000` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Paramètres MySQL | voir `webapp/app.js` |
| `AWS_REGION` | Région utilisée par S3/Rekognition | `us-east-1` |
| `BUCKET_NAME` | Bucket cible pour l’upload | `myfaces-uploads-ayoub2025` |
| `ENABLE_PUBLIC_PHOTO_PREVIEW` | `true` pour afficher les photos directement (bucket public ou CloudFront requis) | `false` |
| `PUBLIC_MEDIA_BASE_URL` | URL publique (S3 website, CloudFront, API Gateway) pour servir les photos | `https://<bucket>.s3.<region>.amazonaws.com` |

## Structure

```
├── config/                # Schéma SQL + templates CloudFormation (VPC, SG)
├── docs/                  # Documentation (architecture, déploiement, FAQ, sécurité)
├── lambda/                # Code Lambda (source + version prête à zipper)
├── scripts/               # Scripts Bash d’automatisation
├── webapp/                # Application Express (upload + visualisation)
└── README.md              # Ce guide
```

## Scripts utiles

| Script | Rôle |
|--------|------|
| `scripts/setup-database.sh` | Applique le schéma SQL sur MySQL en utilisant les variables d’environnement `DB_*`. |
| `scripts/deploy-vpc.sh` | Déploie la VPC de labo via CloudFormation (`config/vpc-config.json`). |
| `scripts/deploy-ec2.sh` | Lance une instance EC2 dans la VPC et associe les security groups fournis. |

Chaque script est auto-documenté (`--help`). Consultez `docs/deployment.md` pour l’ordre d’exécution.

## Flux de données

1. L’utilisateur charge une photo via `/upload` (Express + Multer).
2. L’image est sauvegardée temporairement, normalisée (`nom_prenom.ext`), poussée dans S3 puis enregistrée dans MySQL avec un état « PENDING ».
3. Une notification S3 déclenche Lambda, qui indexe la photo dans AWS Rekognition et met à jour la table `person` avec le `FaceId`.
4. L’interface `/faces` lit MySQL et affiche les résultats (JSON disponible via `/api/faces`).

## Ressources supplémentaires

- [docs/architecture.md](docs/architecture.md) : détails de chaque composant.
- [docs/deployment.md](docs/deployment.md) : marche à suivre pour recréer l’environnement.
- [docs/security.md](docs/security.md) : liste de contrôles et de recommandations.
- [docs/faq.md](docs/faq.md) : questions fréquentes.

Bon lab ! 🎉
