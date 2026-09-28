const path = require('node:path');
const express = require('express');
const axios = require('axios');

// Create the Express app; server.js starts listening for requests.
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

// Render pages with EJS and serve files from public.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// All external requests use the same timeout and return the JSON response body.
async function getApiData(url, params) {
  const { data } = await axios.get(url, { params, timeout: 10000 });
  return data;
}

// Query parameters can be arrays; accept only a single string value.
function queryText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function displayName(name) {
  return name.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Shared defaults keep the search and browsing controls available on every page.
app.use((request, response, next) => {
  response.locals = {
    ...response.locals,
    pageTitle: 'Pokédex', search: '', pokemon: null, error: null,
    pokemonTypes, selectedType: '', matches: null, displayName, city: '', weather: null, recommendations: null,
  };
  next();
});

async function getPokemonByType(type) {
  if (!typeCache.has(type)) {
    // The type endpoint nests each matching name inside entry.pokemon.
    const data = await getApiData(`https://pokeapi.co/api/v2/type/${type}`);
    typeCache.set(type, data.pokemon.map((entry) => entry.pokemon.name));
  }
  return typeCache.get(type);
}

async function getPokemon(lookup) {
  let pokemon = pokemonCache.get(lookup);
  if (!pokemon) {
    const data = await getApiData(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(lookup)}`);
    pokemon = {
      id: data.id,
      name: displayName(data.name),
      image: data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default,
      // PokeAPI uses decimeters for height and hectograms for weight; convert to m and kg.
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
    // Cache both identifiers so a name search and an ID search share the same result.
    pokemonCache.set(data.name, pokemon);
    pokemonCache.set(String(data.id), pokemon);
  }
  return pokemon;
}

function chooseRecommendations(names) {
  // Copy and deduplicate the list so sampling never changes the cached type results.
  const remaining = [...new Set(names)];
  const selected = [];
  // Remove each pick from the pool: up to five random names, with no duplicates.
  while (selected.length < 5 && remaining.length > 0) {
    const index = Math.floor(Math.random() * remaining.length);
    selected.push(remaining.splice(index, 1)[0]);
  }
  return selected;
}

// Open-Meteo returns WMO weather codes. The type pairings are our app's own rules.
function weatherTheme(code) {
  // 95/96/99: thunderstorms; 71-77 and 85/86: snow or snow showers.
  if ([95, 96, 99].includes(code)) return { condition: 'Thunderstorms', type: 'electric' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { condition: 'Snow', type: 'ice' };
  // 51-57: drizzle; 61-67: rain (including freezing rain); 80-82: rain showers.
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { condition: 'Rain or drizzle', type: 'water' };
  }
  // 45/48: fog; 0/1: clear or mainly clear; 2/3: partly cloudy or overcast.
  if ([45, 48].includes(code)) return { condition: 'Fog', type: 'ghost' };
  if ([0, 1].includes(code)) return { condition: 'Clear or mainly clear skies', type: 'fire' };
  if ([2, 3].includes(code)) return { condition: 'Cloudy skies', type: 'flying' };
  return { condition: 'Other weather conditions', type: 'normal' };
}

app.get('/weather', async (request, response) => {
  const city = queryText(request.query.city).replace(/\s+/g, ' ');
  const view = { city };
  if (city.length < 2 || city.length > 100) {
    return response.status(400).render('index', {
      ...view, error: 'Enter a city name between 2 and 100 characters.',
    });
  }
  try {
    // Geocoding converts the city name to coordinates; count: 1 selects the first match.
    // Axios encodes params in the URL, and timeout limits each request to 10 seconds.
    const locations = await getApiData('https://geocoding-api.open-meteo.com/v1/search', {
      name: city, count: 1, language: 'en', format: 'json',
    });
    const location = locations.results?.[0];
    if (!location) {
      return response.status(404).render('index', {
        ...view, error: 'No city found. Check the spelling and try another city name.',
      });
    }
    // Request current temperature (Celsius by default) and weather code in local time.
    const data = await getApiData('https://api.open-meteo.com/v1/forecast', {
      latitude: location.latitude, longitude: location.longitude,
      current: 'temperature_2m,weather_code', timezone: 'auto',
    });
    if (!Number.isFinite(data.current?.temperature_2m) || !Number.isInteger(data.current?.weather_code)) {
      throw new Error('Current weather unavailable');
    }
    const theme = weatherTheme(data.current.weather_code);
    view.weather = {
      ...theme,
      location: [location.name, location.admin1, location.country].filter(Boolean).join(', '),
      temperature: data.current.temperature_2m,
    };
    // Connect the APIs: use the weather's suggested type to fetch matching Pokemon.
    const matches = await getPokemonByType(theme.type);
    const selected = chooseRecommendations(matches);
    // Load just the five selected details in parallel, reusing the search cache.
    // A failed detail request still leaves a working name link for that suggestion.
    const recommendations = await Promise.all(selected.map(async (name) => {
      try {
        const pokemon = await getPokemon(name);
        return { name, image: pokemon.image };
      } catch (error) {
        return { name, image: null };
      }
    }));
    return response.render('index', { ...view, selectedType: theme.type, recommendations });
  } catch (error) {
    return response.status(503).render('index', {
      ...view,
      error: view.weather
        ? 'Weather loaded, but Pokémon suggestions are unavailable. Please try again.'
        : 'We could not load the weather right now. Please try your city again in a moment.',
    });
  }
});
app.get('/types', async (request, response) => {
  const selectedType = queryText(request.query.type);
  if (!pokemonTypes.includes(selectedType)) {
    return response.status(400).render('index', { error: 'Choose a Pokémon type from the list.' });
  }
  try {
    const matches = await getPokemonByType(selectedType);
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
      const data = await getApiData('https://pokeapi.co/api/v2/pokemon?limit=100000');
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
  const search = queryText(request.query.search);
  const view = { search };

  if (request.query.search === undefined) {
    return response.render('index', view);
  }

  if (!search || search.length > 100 || !/^[a-zA-Z0-9-]+$/.test(search)) {
    view.error = 'Enter a Pokémon name or number, such as pikachu or 25. Use hyphens for forms, such as mr-mime.';
    return response.status(400).render('index', view);
  }

  const lookup = /^\d+$/.test(search) ? search.replace(/^0+(?=\d)/, '') : search.toLowerCase();

  try {
    const pokemon = await getPokemon(lookup);
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
