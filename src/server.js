const app = require('./app');

// Use the hosting environment's port when provided, or 3000 for local development.
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Mini Project 2 is running at http://localhost:${port}`);
});
