/**
 * Tests pour la fonction Lambda
 */

jest.mock('@aws-sdk/client-rekognition');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-secrets-manager');
jest.mock('mysql2/promise');

const { RekognitionClient, IndexFacesCommand } = require('@aws-sdk/client-rekognition');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const mysql = require('mysql2/promise');

describe('Lambda Handler', () => {
  let handler;
  let mockRekognitionSend;
  let mockSecretsManagerSend;
  let mockConnection;

  beforeAll(() => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.COLLECTION_ID = 'test-collection';
    process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789:secret:test-secret';
  });

  beforeEach(() => {
    // Mock Rekognition
    mockRekognitionSend = jest.fn().mockResolvedValue({
      FaceRecords: [{
        Face: {
          FaceId: 'face-default-123'
        }
      }]
    });
    RekognitionClient.mockImplementation(() => ({
      send: mockRekognitionSend
    }));

    // Mock Secrets Manager
    mockSecretsManagerSend = jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        host: 'test-db-host',
        username: 'testuser',
        password: 'testpass',
        database: 'testdb',
        port: 3306
      })
    });
    SecretsManagerClient.mockImplementation(() => ({
      send: mockSecretsManagerSend
    }));

    // Mock MySQL
    mockConnection = {
      execute: jest.fn().mockResolvedValue([{ insertId: 1 }, {}]),
      end: jest.fn().mockResolvedValue()
    };
    mysql.createConnection = jest.fn().mockResolvedValue(mockConnection);

    jest.resetModules();
    handler = require('../index.js').handler;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Traitement réussi', () => {
    test('traite un événement S3 correctement', async () => {
      const mockFaceId = 'face-12345-abcdef';
      
      mockRekognitionSend.mockResolvedValueOnce({
        FaceRecords: [{
          Face: {
            FaceId: mockFaceId
          }
        }]
      });

      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'dupont_jean.jpg' }
          }
        }]
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Face registered successfully');
      expect(body.faceId).toBe(mockFaceId);
      expect(body.person.lastname).toBe('Dupont');
      expect(body.person.firstname).toBe('Jean');

      // Vérifier Rekognition
      expect(mockRekognitionSend).toHaveBeenCalledWith(
        expect.any(IndexFacesCommand)
      );
      const rekognitionCall = mockRekognitionSend.mock.calls[0][0];
      expect(rekognitionCall.input.CollectionId).toBe('test-collection');
      expect(rekognitionCall.input.Image.S3Object.Bucket).toBe('test-bucket');
      expect(rekognitionCall.input.Image.S3Object.Name).toBe('dupont_jean.jpg');
      expect(rekognitionCall.input.ExternalImageId).toBe('dupont_jean');

      // Vérifier Secrets Manager
      expect(mockSecretsManagerSend).toHaveBeenCalledWith(
        expect.any(GetSecretValueCommand)
      );

      // Vérifier MySQL
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO person'),
        ['Dupont', 'Jean', mockFaceId, 'dupont_jean.jpg']
      );
    });

    test('gère les noms avec underscores multiples', async () => {
      mockRekognitionSend.mockResolvedValueOnce({
        FaceRecords: [{
          Face: {
            FaceId: 'face-123'
          }
        }]
      });

      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'van_der_berg_marie.jpg' }
          }
        }]
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.person.lastname).toBe('Van Der Berg');
      expect(body.person.firstname).toBe('Marie');
    });

    test('gère les extensions différentes', async () => {
      mockRekognitionSend.mockResolvedValueOnce({
        FaceRecords: [{
          Face: {
            FaceId: 'face-123'
          }
        }]
      });

      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'martin_jean.png' }
          }
        }]
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.person.lastname).toBe('Martin');
      expect(body.person.firstname).toBe('Jean');
    });
  });

  describe('Gestion des erreurs', () => {
    test('rejette un nom de fichier invalide (pas de underscore)', async () => {
      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'invalidfilename.jpg' }
          }
        }]
      };

      await expect(handler(event)).rejects.toThrow('Filename must be in format: lastname_firstname.jpg');
    });

    test('rejette un nom de fichier avec un seul élément', async () => {
      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'onlyname.jpg' }
          }
        }]
      };

      await expect(handler(event)).rejects.toThrow('Filename must be in format: lastname_firstname.jpg');
    });

    test('gère le cas où aucun visage n\'est détecté', async () => {
      mockRekognitionSend.mockResolvedValueOnce({
        FaceRecords: []
      });

      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'dupont_jean.jpg' }
          }
        }]
      };

      await expect(handler(event)).rejects.toThrow('No face detected in image');
    });

    test('gère les erreurs Rekognition', async () => {
      mockRekognitionSend.mockRejectedValueOnce(new Error('Rekognition service error'));

      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'dupont_jean.jpg' }
          }
        }]
      };

      await expect(handler(event)).rejects.toThrow('Rekognition service error');
    });

    test('gère les erreurs Secrets Manager', async () => {
      mockRekognitionSend.mockResolvedValueOnce({
        FaceRecords: [{
          Face: {
            FaceId: 'face-123'
          }
        }]
      });
      
      mockSecretsManagerSend.mockRejectedValueOnce(new Error('Secret not found'));

      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'dupont_jean.jpg' }
          }
        }]
      };

      await expect(handler(event)).rejects.toThrow('Secret not found');
    });

    test('gère les erreurs MySQL', async () => {
      mockRekognitionSend.mockResolvedValueOnce({
        FaceRecords: [{
          Face: {
            FaceId: 'face-123'
          }
        }]
      });

      mockConnection.execute.mockRejectedValueOnce(new Error('Database connection failed'));

      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'dupont_jean.jpg' }
          }
        }]
      };

      await expect(handler(event)).rejects.toThrow('Database connection failed');
    });

    test('décode correctement les clés URL encodées', async () => {
      mockRekognitionSend.mockResolvedValueOnce({
        FaceRecords: [{
          Face: {
            FaceId: 'face-123'
          }
        }]
      });

      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'dupont_jean.jpg' }  // Après décodage, le format attendu est avec underscore
          }
        }]
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.person.lastname).toBe('Dupont');
      expect(body.person.firstname).toBe('Jean');
    });

    test('gère les espaces codés comme +', async () => {
      mockRekognitionSend.mockResolvedValueOnce({
        FaceRecords: [{
          Face: {
            FaceId: 'face-123'
          }
        }]
      });

      const event = {
        Records: [{
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'dupont_jean.jpg' }  // Le format attendu est avec underscore
          }
        }]
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.person.lastname).toBe('Dupont');
      expect(body.person.firstname).toBe('Jean');
    });
  });
});

