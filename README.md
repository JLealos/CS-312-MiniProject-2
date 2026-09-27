# CS 312 Mini Project 2

A locally run public API web application built with Node.js, Express.js, Axios, and EJS.

## Project roadmap

1. Set up the project and dependencies.
2. Add the Express server, routes, and EJS page structure.
3. Choose a CORS-enabled public API that requires no authentication and plan the app.
4. Add user input, Axios API requests, and server-rendered results.
5. Handle invalid input and API errors with helpful retry messages.
6. Add responsive styling.
7. Test the main user workflows across desktop and mobile layouts.

## Setup

```text
npm install
```

## Development commands

```text
npm run dev
npm start
npm test
```

## Application structure

- `src/app.js`: Express configuration, form parsing, static files, and routes.
- `src/server.js`: Starts the server on port 3000 by default.
- `views/`: EJS templates rendered by the server.
- `public/`: Static files such as CSS, images, and browser JavaScript.
