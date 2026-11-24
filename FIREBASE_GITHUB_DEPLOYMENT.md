# Firebase configuration and GitHub deployment

## What is and is not secret

Firebase's web app configuration, including `FIREBASE_API_KEY`, is included in
the browser bundle so the storefront can connect to Firebase. It is not a
server credential, and putting it in a GitHub Secret does not make it private
after deployment. Keep it out of source control to avoid accidental leaks, but
secure the Firebase project with Firestore Security Rules, Authentication,
App Check, and API restrictions where available.

Never put an administrator password, service-account JSON, or private key in
the Angular app, a committed file, or the generated browser config. The
Firebase service-account key used for GitHub deployment is a real credential;
store it only as a GitHub Environment Secret.

## Local development

1. Copy `.env.example` to `.env`.
2. Replace the placeholder values with the Firebase web app configuration from
   Firebase Console > Project settings > General > Your apps.
3. Keep `.env` local. It is ignored by Git.
4. Run `npm start` or `npm run build`. The config generator reads `.env` and
   writes the ignored `src/environments/firebase-config.generated.ts`.

The generator also accepts the same `FIREBASE_*` values from process
environment variables. In CI, those variables take precedence over `.env`, and
the build works without a `.env` file.

## Add Firebase settings to a GitHub Environment

1. Push the project to a GitHub repository.
2. Open **Settings > Environments > New environment**, create an environment
   named `production`, and save it.
3. Open that environment's **Variables** section and add the Firebase web app
   settings below. Use GitHub **Variables**, not Secrets, for these browser
   config values because they are public in the deployed app.

   | Variable | Required | Firebase Console value |
   | --- | --- | --- |
   | `FIREBASE_API_KEY` | Yes | Web API key |
   | `FIREBASE_AUTH_DOMAIN` | Yes | Auth domain |
   | `FIREBASE_PROJECT_ID` | Yes | Project ID |
   | `FIREBASE_APP_ID` | Yes | App ID |
   | `FIREBASE_DATABASE_URL` | No | Realtime Database URL, if used |
   | `FIREBASE_STORAGE_BUCKET` | No | Storage bucket, if used |
   | `FIREBASE_MESSAGING_SENDER_ID` | No | Messaging sender ID, if used |
   | `FIREBASE_MEASUREMENT_ID` | No | Analytics measurement ID, if used |

4. To let GitHub Actions deploy to Firebase Hosting, create a dedicated Google
   Cloud service account for deployment and grant it only the Firebase Hosting
   permissions it needs. Do not grant Owner. Create a key only if your
   organization's policy allows long-lived keys, then add the complete service
   account JSON as an Environment **Secret** named
   `FIREBASE_SERVICE_ACCOUNT`. Do not commit or paste that JSON into the
   storefront. Prefer short-lived OIDC-based credentials when your deployment
   setup supports them.
5. Add a workflow at `.github/workflows/firebase-hosting.yml`, using the
   following example. Change `main` if your production branch has a different
   name. The workflow build step supplies the Firebase variables to the
   generator; the Hosting action publishes `dist/flower-shop/browser` as
   configured in `firebase.json`.

```yaml
name: Build and deploy Firebase Hosting

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          FIREBASE_API_KEY: ${{ vars.FIREBASE_API_KEY }}
          FIREBASE_AUTH_DOMAIN: ${{ vars.FIREBASE_AUTH_DOMAIN }}
          FIREBASE_DATABASE_URL: ${{ vars.FIREBASE_DATABASE_URL }}
          FIREBASE_PROJECT_ID: ${{ vars.FIREBASE_PROJECT_ID }}
          FIREBASE_STORAGE_BUCKET: ${{ vars.FIREBASE_STORAGE_BUCKET }}
          FIREBASE_MESSAGING_SENDER_ID: ${{ vars.FIREBASE_MESSAGING_SENDER_ID }}
          FIREBASE_APP_ID: ${{ vars.FIREBASE_APP_ID }}
          FIREBASE_MEASUREMENT_ID: ${{ vars.FIREBASE_MEASUREMENT_ID }}
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: ${{ vars.FIREBASE_PROJECT_ID }}
          channelId: live
```

GitHub environment-level variables and secrets are available to a job only
when it declares `environment: production`. The workflow above deploys every
push to `main`; protect that branch and restrict who can update the production
environment and its deployment secret.

## Security checklist

- Keep `.env`, generated config, service-account files, and private keys
  untracked. `.gitignore` only prevents future accidental additions; it does not
  remove files already committed.
- If a real password, service-account key, or other private credential was
  committed or shared, revoke/rotate it immediately. Deleting the file in a
  later commit does not erase it from Git history.
- Firebase web API keys are public identifiers, not authorization. Restrict
  them where possible, configure authorized domains, enable App Check, and
  review Firestore rules before deployment.
- Never deploy Firestore rules that grant unrestricted access. Publish the
  project's reviewed `firestore.rules` separately with Firebase CLI or through
  Firebase Console.
