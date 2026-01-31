import express from 'express';

const app = express();
// Railway provides the PORT automatically via environment variables
const PORT = process.env.PORT || 3000;

// Add the missing /health route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

// A default route so the main page works too
app.get('/', (req, res) => {
  res.send('Welcome to SlimJan Bank Statement UI!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});