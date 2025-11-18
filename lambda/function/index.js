const mysql = require('mysql2/promise');
const { RekognitionClient, IndexFacesCommand } = require('@aws-sdk/client-rekognition');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const rekognitionClient = new RekognitionClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

const beautifyName = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    || 'Inconnu';

exports.handler = async (event) => {
  try {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    // 1. Récupérer les informations du fichier S3
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    
    console.log(`Processing file: ${key} from bucket: ${bucket}`);
    
    // 2. Parser le nom du fichier (format: doe_jane.jpg)
    const fileNameWithoutExt = key.replace(/\.[^/.]+$/, ''); // Enlever l'extension
    const parts = fileNameWithoutExt.split('_');
    
    if (parts.length < 2) {
      throw new Error('Filename must be in format: lastname_firstname.jpg');
    }
    
      const lastname = beautifyName(parts[0]);
      const firstname = beautifyName(parts.slice(1).join(' '));
      const externalId = fileNameWithoutExt;
    
    console.log(`Parsed filename: ${lastname} ${firstname}, externalId: ${externalId}`);
    
    // 3. Appeler Rekognition pour indexer le visage
    const rekognitionParams = {
      CollectionId: process.env.COLLECTION_ID,
      Image: {
        S3Object: {
          Bucket: bucket,
          Name: key
        }
      },
      ExternalImageId: externalId,
      DetectionAttributes: ['ALL']
    };
    
    const rekognitionResult = await rekognitionClient.send(new IndexFacesCommand(rekognitionParams));
    
    if (!rekognitionResult.FaceRecords || rekognitionResult.FaceRecords.length === 0) {
      throw new Error('No face detected in image');
    }
    
    const faceId = rekognitionResult.FaceRecords[0].Face.FaceId;
    console.log(`FaceId generated: ${faceId}`);
    
    // 4. Récupérer les credentials de la DB depuis Secrets Manager
    const secretCommand = new GetSecretValueCommand({
      SecretId: process.env.DB_SECRET_ARN
    });
    const secretData = await secretsClient.send(secretCommand);
    const dbCredentials = JSON.parse(secretData.SecretString);
    
    // 5. Se connecter à MySQL
    const connection = await mysql.createConnection({
      host: dbCredentials.host,
      user: dbCredentials.username,
      password: dbCredentials.password,
      database: dbCredentials.database,
      port: dbCredentials.port || 3306,
      connectTimeout: 10000
    });
    
    // 6. Insérer dans la base de données
      const query = `
        INSERT INTO person (lastname, firstname, identity, object_key)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          identity = VALUES(identity),
          object_key = VALUES(object_key),
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await connection.execute(query, [lastname, firstname, faceId, key]);
    
    console.log(`Saved to DB: ${lastname} ${firstname} → ${faceId}`);
    
    await connection.end();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Face registered successfully',
        faceId: faceId,
        person: { lastname, firstname }
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
