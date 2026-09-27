const path = require('node:path');
const express = require('express');
const axios = require('axios');

const app = express();
// Reuse successful lookups during this server session, as PokéAPI requests.
const pokemonCache = new Map();
const typeCache = new Map();
let randomCandidates;
const pokemonTypes = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function displayName(name) {
  return name.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Shared defaults keep the search and browsing controls available on every page.
app.use((request, response, next) => {
  response.locals = {
    ...response.locals,
    pageTitle: 'Pokédex', search: '', pokemon: null, error: null,
    pokemonTypes, selectedType: '', matches: null, displayName,
  };
  next();
});

app.get('/types', async (request, response) => {
  const selectedType = typeof request.query.type === 'string' ? request.query.type : '';
  if (!pokemonTypes.includes(selectedType)) {
    return response.status(400).render('index', { error: 'Choose a Pokémon type from the list.' });
  }
  try {
    let matches = typeCache.get(selectedType);
    if (!matches) {
      const { data } = await axios.get(`https://pokeapi.co/api/v2/type/${selectedType}`, { timeout: 10000 });
      matches = data.pokemon.map((entry) => entry.pokemon.name);
      typeCache.set(selectedType, matches);
    }
    return response.render('index', { selectedType, matches });
  } catch (error) {
    return response.status(503).render('index', {
      selectedType, error: 'We could not load that type right now. Please try filtering again.',
    });
  }
});

app.get('/random', async (request, response) => {
  try {
    // Pick from the API list rather than guessing a maximum Pokémon number.
    if (!randomCandidates) {
      const { data } = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=100000', { timeout: 10000 });
      if (!data.results.length) throw new Error('No Pokémon available');
      randomCandidates = data.results.map((entry) => entry.name);
    }
    const name = randomCandidates[Math.floor(Math.random() * randomCandidates.length)];
    response.set('Cache-Control', 'no-store');
    return response.redirect(`/?search=${encodeURIComponent(name)}`);
  } catch (error) {
    return response.status(503).render('index', {
      error: 'We could not choose a random Pokémon right now. Please try again.',
    });
  }
});

app.get('/', async (request, response) => {
  const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
  const view = { pageTitle: 'Pokédex', search, pokemon: null, error: null };

  if (request.query.search === undefined) {
    return response.render('index', view);
  }

  if (!search || search.length > 100 || !/^[a-zA-Z0-9-]+$/.test(search)) {
    view.error = 'Enter a Pokémon name or number, such as pikachu or 25. Use hyphens for forms, such as mr-mime.';
    return response.status(400).render('index', view);
  }

  const lookup = /^\d+$/.test(search) ? search.replace(/^0+(?=\d)/, '') : search.toLowerCase();

  try {
    let pokemon = pokemonCache.get(lookup);
    if (!pokemon) {
      const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(lookup)}`, {
        timeout: 10000,
      });
      pokemon = {
        id: data.id,
        name: displayName(data.name),
        image: data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default,
        height: data.height / 10,
        weight: data.weight / 10,
        types: data.types.map((entry) => displayName(entry.type.name)),
        abilities: data.abilities.map((entry) => ({
          name: displayName(entry.ability.name),
          hidden: entry.is_hidden,
        })),
        stats: data.stats.map((entry) => ({
          name: entry.stat.name === 'hp' ? 'HP' : displayName(entry.stat.name),
          value: entry.base_stat,
        })),
      };
      pokemonCache.set(data.name, pokemon);
      pokemonCache.set(String(data.id), pokemon);
    }
    view.pokemon = pokemon;
    return response.render('index', view);
  } catch (error) {
    if (error.response?.status === 404) {
      view.error = 'No Pokémon found. Check the name or number and try again.';
      return response.status(404).render('index', view);
    }
    view.error = 'We could not reach PokéAPI right now. Please try your search again in a moment.';
    return response.status(503).render('index', view);
  }
});

app.get('/health', (request, response) => {
  response.json({ status: 'ok' });
});

module.exports = app;
