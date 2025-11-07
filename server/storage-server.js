import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const ASSETS_FILE = path.join(__dirname, '../assets.json');

app.use(cors());
app.use(express.json());

// Endpoint para carregar os ativos
app.get('/api/assets', async (req, res) => {
  try {
    const data = await fs.readFile(ASSETS_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Arquivo não existe, retorna vazio
      const emptyData = { assets: [], lastUpdated: new Date().toISOString(), version: '1.0' };
      await fs.writeFile(ASSETS_FILE, JSON.stringify(emptyData, null, 2));
      res.json(emptyData);
    } else {
      res.status(500).json({ error: 'Erro ao ler arquivo' });
    }
  }
});

// Endpoint para salvar os ativos
app.post('/api/assets', async (req, res) => {
  try {
    const data = {
      assets: req.body.assets || [],
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    };
    await fs.writeFile(ASSETS_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, message: 'Ativos salvos com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar arquivo' });
  }
});

app.listen(PORT, () => {
  console.log(`🔒 Servidor de storage rodando em http://localhost:${PORT}`);
  console.log(`📁 Arquivo: ${ASSETS_FILE}`);
});
