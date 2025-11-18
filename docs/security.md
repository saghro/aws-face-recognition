# Notes de sécurité

1. **Isolation réseau**  
   - Déployez l’application et RDS dans des sous-réseaux privés. Autorisez uniquement l’ALB (ports 80/443 → 3000) et la Lambda (port 3306) via les security groups fournis.

2. **Gestion des secrets**  
   - Ne stockez jamais les identifiants DB en clair dans le code. Utilisez AWS Secrets Manager (déjà consommé par Lambda) ou SSM Parameter Store côté webapp.

3. **Chiffrement**  
   - Activez le chiffrement côté serveur sur S3 (SSE-S3 ou SSE-KMS) et sur RDS (Storage Encryption).
   - Si vous stockez des buckets publics, appliquez des policies restrictives et, idéalement, servez les images via CloudFront avec des URL signées.

4. **IAM least privilege**  
   - Le rôle Lambda doit se limiter à `rekognition:IndexFaces`, `s3:GetObject`, `s3:PutObject`, `secretsmanager:GetSecretValue`, `rds-db:connect` (ou `mysql:connect`).
   - Le rôle EC2/ECS doit uniquement pouvoir écrire dans CloudWatch Logs et lire (optionnel) un Parameter Store.

5. **Validation et audit**  
   - Multer accepte uniquement les MIME de type image et limite la taille. Ajoutez un antivirus (ex. AWS Scan, ClamAV) pour des besoins sensibles.
   - Activez CloudTrail + GuardDuty pour surveiller les accès S3/Rekognition.

6. **Protection des données personnelles**  
   - Obtenez le consentement des personnes photographiées.
   - Définissez une durée de rétention et un processus de suppression (`DeleteFaces` + purge MySQL).

7. **Surveillance**  
   - Créez des alarmes CloudWatch sur les erreurs Lambda, la latence ALB, l’espace disque RDS.
   - Activez Performance Insights sur RDS pour repérer les requêtes lentes.

8. **Plan de reprise**  
   - Sauvegardez la base (snapshots RDS automatiques) et répliquez le bucket (S3 Cross-Region Replication) si l’usage est critique.

En suivant ces recommandations, le lab peut évoluer vers un environnement quasi production-ready tout en maîtrisant les risques liés aux données biométriques.
