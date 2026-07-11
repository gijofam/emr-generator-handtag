require('dotenv').config();
const express = require('express');
const cors = require('cors');
const handtagRoutes = require('./routes/handtagRoutes');
const batchRoutes = require('./routes/batchRoutes');
const templatesRoutes = require('./routes/templatesRoutes');
const calibrationRoutes = require('./routes/calibrationRoutes');
const calibrationController = require('./controllers/calibrationController');
const appConfig = require('./config/app');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use('/output', express.static(appConfig.outputDir));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/calibration/ping', (_req, res) => {
  res.json({ status: 'calibration-ok' });
});

app.post('/api/calibration/preview', calibrationController.previewPdf);

app.use('/api/handtags', handtagRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/calibration', calibrationRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
