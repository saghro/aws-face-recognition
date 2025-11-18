/**
 * Tests d'intégration pour l'API Express
 */

const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');

// Mock des dépendances AWS et MySQL avant l'import de l'app
jest.mock('@aws-sdk/client-s3');
jest.mock('mysql2/promise', () => ({
  __esModule: true,
  default: jest.fn(),
  createConnection: jest.fn()
}));

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mysql = require('mysql2/promise');

describe('API Express', () => {
  let app;
  let mockS3Send;
  let mockConnection;

  beforeAll(() => {
    // Créer un dossier temporaire pour les uploads
    process.env.NODE_ENV = 'test';
    process.env.UPLOAD_DIR = '/tmp';
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.DB_HOST = 'localhost';
    process.env.DB_USER = 'testuser';
    process.env.DB_PASSWORD = 'testpass';
    process.env.DB_NAME = 'testdb';
    process.env.PORT = '0'; // Port aléatoire pour les tests
  });

  beforeEach(() => {
    // Réinitialiser les modules avant de configurer les mocks
    jest.resetModules();
    
    // Mock S3
    mockS3Send = jest.fn().mockResolvedValue({});
    S3Client.mockImplementation(() => ({
      send: mockS3Send
    }));

    // Mock MySQL - réinitialiser la fonction mockée
    mockConnection = {
      execute: jest.fn().mockResolvedValue([[], {}]),
      end: jest.fn().mockResolvedValue()
    };
    mysql.createConnection.mockReset();
    mysql.createConnection.mockResolvedValue(mockConnection);

    // Charger l'app après avoir configuré les mocks
    delete require.cache[require.resolve('../app.js')];
    app = require('../app.js');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    test('retourne la page d\'accueil', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Face Recognition System');
      expect(response.text).toContain('Système intelligent de reconnaissance faciale');
    });
  });

  describe('GET /upload', () => {
    test('retourne le formulaire d\'upload', async () => {
      const response = await request(app).get('/upload');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Ajouter un visage');
      expect(response.text).toContain('enctype="multipart/form-data"');
    });
  });

  describe('GET /api/faces', () => {
    test('retourne la liste des visages en JSON', async () => {
      const mockFaces = [
        { id: 1, lastname: 'Dupont', firstname: 'Jean', identity: 'face-123', object_key: 'dupont_jean.jpg' },
        { id: 2, lastname: 'Martin', firstname: 'Marie', identity: 'face-456', object_key: 'martin_marie.jpg' }
      ];

      // Créer une nouvelle connexion mockée pour ce test
      const testConnection = {
        execute: jest.fn().mockResolvedValue([mockFaces, {}]),
        end: jest.fn().mockResolvedValue()
      };
      mysql.createConnection.mockResolvedValueOnce(testConnection);

      const response = await request(app).get('/api/faces');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        count: 2,
        data: mockFaces
      });
      expect(mysql.createConnection).toHaveBeenCalled();
      expect(testConnection.execute).toHaveBeenCalledWith(
        'SELECT * FROM person ORDER BY id DESC'
      );
    });

    test('gère les erreurs de base de données', async () => {
      const testConnection = {
        execute: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        end: jest.fn().mockResolvedValue()
      };
      mysql.createConnection.mockResolvedValueOnce(testConnection);

      const response = await request(app).get('/api/faces');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Database connection failed'
      });
    });
  });

  describe('GET /healthz', () => {
    test('retourne le statut OK quand la DB est accessible', async () => {
      const testConnection = {
        execute: jest.fn().mockResolvedValue([[1], {}]),
        end: jest.fn().mockResolvedValue()
      };
      mysql.createConnection.mockResolvedValueOnce(testConnection);

      const response = await request(app).get('/healthz');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        db: 'reachable',
        bucket: 'test-bucket',
        region: 'us-east-1'
      });
    });

    test('retourne une erreur quand la DB n\'est pas accessible', async () => {
      mysql.createConnection.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app).get('/healthz');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        status: 'error',
        error: 'Connection refused'
      });
    });
  });

  describe('POST /upload', () => {
    let testImagePath;

    beforeAll(async () => {
      // Créer une image de test minimaliste (1x1 pixel PNG)
      const testDir = '/tmp';
      await fs.mkdir(testDir, { recursive: true });
      testImagePath = path.join(testDir, 'test-image.png');
      
      // PNG minimaliste 1x1 pixel (format binaire)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89,
        0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, // IDAT
        0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
        0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82
      ]);
      await fs.writeFile(testImagePath, pngBuffer);
    });

    afterAll(async () => {
      try {
        await fs.unlink(testImagePath);
      } catch (err) {
        // Ignorer les erreurs de suppression
      }
    });

    test('uploade une image avec succès', async () => {
      const testConnection = {
        execute: jest.fn().mockResolvedValue([{ insertId: 1 }, {}]),
        end: jest.fn().mockResolvedValue()
      };
      mysql.createConnection.mockResolvedValueOnce(testConnection);

      const response = await request(app)
        .post('/upload')
        .field('lastname', 'Dupont')
        .field('firstname', 'Jean')
        .attach('photo', testImagePath);

      expect(response.status).toBe(200);
      expect(response.text).toContain('Upload réussi');
      expect(response.text).toContain('Jean Dupont');
      
      // Vérifier que S3 a été appelé
      expect(mockS3Send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );
      
      const putCommand = mockS3Send.mock.calls[0][0];
      expect(putCommand.input.Bucket).toBe('test-bucket');
      expect(putCommand.input.Key).toBe('dupont_jean.png');
      
      // Vérifier que MySQL a été appelé
      expect(testConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO person'),
        ['Dupont', 'Jean', null, 'dupont_jean.png']
      );
    });

    test('rejette l\'upload sans nom', async () => {
      const response = await request(app)
        .post('/upload')
        .field('firstname', 'Jean')
        .attach('photo', testImagePath);

      expect(response.status).toBe(400);
      expect(response.text).toContain('Champs obligatoires');
    });

    test('rejette l\'upload sans prénom', async () => {
      const response = await request(app)
        .post('/upload')
        .field('lastname', 'Dupont')
        .attach('photo', testImagePath);

      expect(response.status).toBe(400);
      expect(response.text).toContain('Champs obligatoires');
    });

    test('rejette l\'upload sans fichier', async () => {
      const response = await request(app)
        .post('/upload')
        .field('lastname', 'Dupont')
        .field('firstname', 'Jean');

      expect(response.status).toBe(400);
      expect(response.text).toContain('Fichier manquant');
    });

    test('gère les erreurs S3', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('S3 upload failed'));
      const testConnection = {
        execute: jest.fn().mockResolvedValue([{ insertId: 1 }, {}]),
        end: jest.fn().mockResolvedValue()
      };
      mysql.createConnection.mockResolvedValueOnce(testConnection);

      const response = await request(app)
        .post('/upload')
        .field('lastname', 'Dupont')
        .field('firstname', 'Jean')
        .attach('photo', testImagePath);

      expect(response.status).toBe(500);
      expect(response.text).toContain('Échec de l');
      expect(response.text).toContain('upload');
    });
  });

  describe('GET /faces', () => {
    test('affiche la liste des visages', async () => {
      const mockFaces = [
        { 
          id: 1, 
          lastname: 'dupont', 
          firstname: 'jean', 
          identity: 'face-123', 
          object_key: 'dupont_jean.jpg' 
        }
      ];

      const testConnection = {
        execute: jest.fn().mockResolvedValue([mockFaces, {}]),
        end: jest.fn().mockResolvedValue()
      };
      mysql.createConnection.mockResolvedValueOnce(testConnection);

      const response = await request(app).get('/faces');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Visages Enregistrés');
      expect(response.text).toContain('Jean');
      expect(response.text).toContain('Dupont');
    });

    test('affiche un message quand il n\'y a pas de visages', async () => {
      const testConnection = {
        execute: jest.fn().mockResolvedValue([[], {}]),
        end: jest.fn().mockResolvedValue()
      };
      mysql.createConnection.mockResolvedValueOnce(testConnection);

      const response = await request(app).get('/faces');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Aucun visage enregistré');
    });
  });
});

