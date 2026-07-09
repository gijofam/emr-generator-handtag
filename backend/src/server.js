require('dotenv').config();
const express = require('express');
const cors = require('cors');
const handtagRoutes = require('./routes/handtagRoutes');
const batchRoutes = require('./routes/batchRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/handtags', handtagRoutes);
app.use('/api/batches', batchRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
