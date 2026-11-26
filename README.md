# Petal & Pot

A responsive flower-shop storefront built with Angular.

## What to install

- Git
- Node.js 20.19+, 22.12+, or 24+
- npm (included with Node.js; no separate install needed)
- Visual Studio Code (optional)

You do not need to install Angular CLI globally; `npm install` installs the
project's dependencies, including its local Angular CLI.

## Clone and install

In a terminal, run:

```sh
git clone https://github.com/cpemistal-debug/cdlem-flower-shop.git
cd cdlem-flower-shop
npm install
```

## Configure Firebase

The app needs Firebase web-app settings to start or build. Create a `.env` file
in the project root and add the required values from your Firebase project
(Firebase Console → Project settings → Your apps):

```dotenv
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_APP_ID=your-app-id
```

Optional settings are `FIREBASE_DATABASE_URL`, `FIREBASE_STORAGE_BUCKET`,
`FIREBASE_MESSAGING_SENDER_ID`, and `FIREBASE_MEASUREMENT_ID`. Do not commit
your `.env` file.

## Run locally

Start the development server:

```sh
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser. Keep the
terminal open while using the app; press `Ctrl+C` to stop the server.

## Build

Create a production build:

```sh
npm run build
```

The generated files are written to `dist/`.

## Notes

Product and category photos are loaded from Unsplash, so an internet connection is needed to display them.
