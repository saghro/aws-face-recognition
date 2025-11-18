# Architecture détaillée

Cette architecture illustre un pipeline serverless piloté par AWS pour construire un registre de visages sécurisé.

## 1. Parcours utilisateur

1. **Upload** : l’utilisateur accède au formulaire `/upload` de l’application Express (hébergée sur EC2, ECS ou Elastic Beanstalk) et soumet un nom/prénom + une photo.
2. **Pré-traitement** : Multer écrit le fichier dans `/tmp`, normalise le nom de fichier (`nom_prenom.ext`) puis l’envoie vers le bucket S3 `myfaces-uploads-ayoub2025` via l’API v3 de l’AWS SDK.
3. **Persistance initiale** : l’application insère/actualise la table `person` (MySQL/Aurora) avec le couple `lastname`/`firstname`, l’`object_key` et un `identity` vide. Cette étape sert de trace et facilite l’UX (le visage apparaît « en attente »).

## 2. Traitement asynchrone

1. **S3 Event** : le bucket publie un événement `ObjectCreated:*` vers une fonction Lambda.
2. **Lambda** : le code (`lambda/index.js`) télécharge l’image, appelle `IndexFaces` (AWS Rekognition) pour obtenir un `FaceId` et met à jour MySQL (même table) via un accès sécurisé (credentials stockés dans Secrets Manager, endpoint privé grâce à la VPC).
3. **Résultat** : le champ `identity` contient désormais le `FaceId` unique et la date `updated_at` est rafraîchie.

## 3. Consultation

- `/faces` affiche des cartes UI réactives. Les images peuvent provenir directement de S3 ou d’un CDN (CloudFront) si `ENABLE_PUBLIC_PHOTO_PREVIEW=true` + `PUBLIC_MEDIA_BASE_URL` renseigné.
- `/api/faces` expose la même donnée en JSON pour intégration (tableau de bord, export, etc.).
- `/healthz` vérifie l’accès MySQL + expose le bucket sélectionné.

## 4. Découpage réseau

- **VPC** dédiée (template `config/vpc-config.json`) avec sous-réseaux publics (ALB, bastion) et privés (EC2/ECS, RDS, Lambda en subnets privés via ENI).
- **Endpoints** : S3 (gateway) et Secrets Manager (interface) pour éviter la sortie vers Internet.
- **Security Groups** (`config/security-groups.json`) :
  - `faces-alb-sg` ouvre 80/443 vers Internet.
  - `faces-app-sg` n’accepte que l’ALB (port 3000) + SSH restreint.
  - `faces-db-sg` accepte uniquement `faces-app-sg` sur 3306.

## 5. Observabilité

- **CloudWatch Logs** : Lambda + application (via CloudWatch Agent) pour les traces.
- **CloudWatch Alarms** : seuil sur erreurs Lambda, latence ALB, connections RDS.
- **AWS X-Ray** (optionnel) pour corréler upload → Lambda → MySQL.

## 6. Points d’attention

- **Convention de nommage** : essentielle pour que Lambda déduise nom/prénom (`lastname_firstname.ext`).
- **Idempotence** : insertions avec `ON DUPLICATE KEY UPDATE` afin de rejouer les événements sans doublon.
- **Confidentialité** : par défaut, les photos ne sont pas servies publiquement. Il faut activer `ENABLE_PUBLIC_PHOTO_PREVIEW` uniquement si le bucket (ou CloudFront) est protégé.

Cette architecture suit l’image fournie (VPC privée, S3/Lambda, RDS, interface admin). Adaptez les modules (ECS/Fargate, API Gateway, etc.) selon vos contraintes de production.
