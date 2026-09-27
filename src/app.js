const path = require('node:path');
const express = require('express');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (request, response) => {
  response.render('index', {
    pageTitle: 'CS 312 Mini Project 2',
  });
});

app.get('/health', (request, response) => {
  response.json({ status: 'ok' });
});

module.exports = app;
