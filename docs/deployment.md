# Guide de déploiement

Ce guide reproduit l’environnement du lab de bout en bout. Les commandes utilisent AWS CLI v2 et un compte disposant des droits IAM nécessaires.

## 1. Prérequis

- AWS CLI configurée (`aws configure`).
- Node.js 20+, npm 10+.
- Accès à une base MySQL (RDS/Aurora ou instance locale).
- Bucket S3 créé dans la région désirée.
- Collection Rekognition pré-existante (`aws rekognition create-collection`).

## 2. Réseau et sécurité

1. **VPC + sous-réseaux**
   ```bash
   ./scripts/deploy-vpc.sh --stack faces-vpc --region us-east-1
   ```
   Le script applique `config/vpc-config.json` et renvoie les identifiants VPC/Subnets.
2. **Security Groups**
   ```bash
   ./scripts/deploy-ec2.sh --step security-groups --vpc-id vpc-xxxx --region us-east-1
   ```
   (Ce script appelle CloudFormation avec `config/security-groups.json`).

## 3. Base de données

1. Créez l’instance RDS (MySQL 8.x) dans un sous-réseau privé et attachez le SG `faces-db-sg`.
2. Dès que l’endpoint est disponible :
   ```bash
   DB_HOST=<endpoint> DB_USER=mydbuser DB_PASSWORD='MySecurePassword123!' \
   ./scripts/setup-database.sh
   ```
   Ce script charge `config/database-schema.sql`.

## 4. Secrets Manager

Stockez les identifiants DB dans un secret JSON :
```bash
aws secretsmanager create-secret \
  --name faces-db-credentials \
  --secret-string '{"host":"mydb.xxxx","username":"mydbuser","password":"MySecurePassword123!","database":"faces_db","port":3306}'
```
Conservez l’ARN (`DB_SECRET_ARN`).

## 5. Bucket S3 + notification

1. Créez/choisissez le bucket `myfaces-uploads-ayoub2025` (versioning recommandé).
2. Ajoutez une notification `s3:ObjectCreated:*` pointant vers la fonction Lambda (voir étape suivante).
3. Activez le **bloquage d’accès public** si vous ne servez pas directement les photos.

## 6. Fonction Lambda

1. Installez les dépendances dans `lambda/function/` puis zippez :
   ```bash
   cd lambda/function
   npm install --production
   zip -r ../function.zip .
   ```
2. Déployez :
   ```bash
   aws lambda create-function \
     --function-name faces-indexer \
     --runtime nodejs20.x \
     --role arn:aws:iam::<account>:role/lambda-rekognition-role \
     --handler index.handler \
     --zip-file fileb://function.zip \
     --timeout 30 --memory-size 1024 \
     --vpc-config SubnetIds=subnet-private-a,subnet-private-b,SecurityGroupIds=sg-app \
     --environment "Variables={AWS_REGION=us-east-1,COLLECTION_ID=faces-collection,DB_SECRET_ARN=arn:aws:secretsmanager:...}" 
   ```
3. Associez le trigger S3 :
   ```bash
   aws lambda create-event-source-mapping \
     --function-name faces-indexer \
     --event-source-arn arn:aws:s3:::myfaces-uploads-ayoub2025 \
     --enabled
   ```
   (ou via `aws s3api put-bucket-notification-configuration`).

## 7. Application Express

1. Déployez l’app sur EC2/ECS/Beanstalk. Exemple EC2 :
   ```bash
   ssh ec2-user@<public-ip>
   git clone <repo>
   cd webapp
   npm install --production
   cat <<ENV >> .env
   PORT=3000
   AWS_REGION=us-east-1
   BUCKET_NAME=myfaces-uploads-ayoub2025
   DB_HOST=<rds-endpoint>
   DB_USER=mydbuser
   DB_PASSWORD=MySecurePassword123!
   DB_NAME=faces_db
   ENABLE_PUBLIC_PHOTO_PREVIEW=false
   ENV
   npm start
   ```
2. Placez l’instance derrière un ALB (listener 80/443) et attachez le SG `faces-app-sg`.

## 8. Vérifications

- `curl http://<alb>/healthz` doit retourner `{"status":"ok"...}`.
- Upload via `/upload` ➜ observez l’objet S3 puis la ligne MySQL (champ `identity` non vide).
- CloudWatch Logs (`/aws/lambda/faces-indexer`) ne doit pas signaler d’erreur.

## 9. Automatisation optionnelle

- **CI/CD** : CodePipeline/CodeBuild pour builder le ZIP Lambda et déployer l’EC2/ECS.
- **IaC complet** : translatez `config/*.json` vers Terraform/CloudFormation mono-stack selon votre politique.

Consultez `docs/security.md` avant toute mise en production.
