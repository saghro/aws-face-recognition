# Tests du Projet Face Recognition

Ce répertoire contient la suite de tests pour le projet de reconnaissance faciale AWS.

## Structure des Tests

### Webapp (`webapp/tests/`)
- **`utils.test.js`** : Tests unitaires pour les fonctions utilitaires (sanitizeKeyPart, beautifyName, escapeHtml, etc.)
- **`api.test.js`** : Tests d'intégration pour les endpoints API Express (GET /, GET /upload, POST /upload, GET /faces, GET /api/faces, GET /healthz)

### Lambda (`lambda/tests/`)
- **`handler.test.js`** : Tests pour la fonction Lambda qui traite les événements S3 et indexe les visages via Rekognition

## Installation

```bash
# Installer les dépendances de la webapp
cd webapp
npm install

# Installer les dépendances de la Lambda
cd ../lambda
npm install
```

## Exécution des Tests

### Webapp
```bash
cd webapp
npm test                # Exécuter tous les tests
npm run test:watch      # Mode watch (surveillance des fichiers)
npm run test:coverage   # Générer un rapport de couverture
```

### Lambda
```bash
cd lambda
npm test                # Exécuter tous les tests
npm run test:watch      # Mode watch
npm run test:coverage   # Rapport de couverture
```

## Configuration Jest

Jest est configuré dans les fichiers `package.json` :
- **Test Environment** : Node.js
- **Coverage Ignore** : node_modules et tests/
- **Test Match** : `**/tests/**/*.test.js`

## Mocks Utilisés

Les tests utilisent des mocks pour :
- **AWS SDK** : S3Client, RekognitionClient, SecretsManagerClient
- **MySQL** : mysql2/promise (createConnection, execute)
- **Fichiers** : fs.promises pour les uploads

## Note

Certains tests peuvent nécessiter des ajustements selon votre environnement. Les mocks sont configurés pour fonctionner en isolation sans dépendances externes.

