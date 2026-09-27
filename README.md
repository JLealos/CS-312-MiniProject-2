# CS 312 Mini Project 2

A locally run Pokédex web application built with Node.js, Express.js, Axios, and EJS. Users can search for a Pokémon by name or number and view its image, types, abilities, and stats.

## Project roadmap

1. Set up the project and dependencies.
2. Add the Express server, routes, and EJS page structure.
3. Choose a CORS-enabled public API that requires no authentication and plan the app.
4. Add user input, Axios API requests, and server-rendered results.
5. Handle invalid input and API errors with helpful retry messages.
6. Add responsive styling.
7. Test the main user workflows across desktop and mobile layouts.

## API choice

This project uses [PokéAPI](https://pokeapi.co/). It is free, supports CORS, and requires no authentication or API key. Its Pokémon data and images make it a good fit for a searchable Pokédex.

The app also uses [Open-Meteo](https://open-meteo.com/) to suggest Pokémon types based on a city's current weather, such as Water for rain or Electric for thunderstorms. No API key is needed for this noncommercial project.

## Run the project

```text
npm install
npm run dev
```

Open http://localhost:3000 in your browser.
