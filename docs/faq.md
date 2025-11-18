# FAQ

**Q : Pourquoi les photos ne s’affichent-elles pas dans `/faces` ?**  
R : L’affichage n’est activé que si `ENABLE_PUBLIC_PHOTO_PREVIEW=true` et si le bucket (ou CloudFront) autorise les GET publics depuis l’URL définie dans `PUBLIC_MEDIA_BASE_URL`. Sans cela, un avatar emoji est montré pour éviter les erreurs 403.

**Q : Le champ `Face ID Rekognition` reste en attente.**  
R : Vérifiez que la notification S3 ➜ Lambda est active, que la variable `COLLECTION_ID` pointe sur une collection existante et que Lambda a les IAM `rekognition:IndexFaces` + `secretsmanager:GetSecretValue` + accès RDS. Consultez les logs CloudWatch.

**Q : Comment gérer les doublons de fichiers ?**  
R : Le nom de fichier est normalisé (`nom_prenom.ext`). Uploader une nouvelle version écrase l’objet S3 et `ON DUPLICATE KEY UPDATE` garde une seule ligne MySQL. Pour conserver l’historique, ajoutez un suffixe (ex. `_2025-01-01`) et adaptez Lambda pour parser la date.

**Q : Peut-on appeler l’API depuis un autre service ?**  
R : Oui via `/api/faces`. Ajoutez un token (middleware) ou placez l’app derrière API Gateway si vous avez besoin d’authentification.

**Q : Comment nettoyer les visages ?**  
R : Supprimez l’objet S3, appelez `rekognition:DeleteFaces` avec le `FaceId` et supprimez la ligne dans MySQL. Automatisez cela via un script Lambda ou Step Functions si besoin.

**Q : Quelles limites de taille pour les fichiers ?**  
R : La limite côté Express est configurable via `MAX_FILE_SIZE_MB` (5 Mo par défaut). Rekognition accepte jusqu’à 15 Mo en synchro.
