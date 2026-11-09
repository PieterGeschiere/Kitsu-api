# Kitsu API

A small static site that shows every anime I've finished, pulled live from my [Kitsu](https://kitsu.app) library.

**Live:** https://pietergeschiere.github.io/Kitsu-api/

## What it does

- Loads all completed entries from the Kitsu public API. It pages through the results and pulls in the anime details with `include=anime`, so it needs only a couple of requests rather than one per title.
- Shows totals at the top: titles, episodes watched, and how many I rated 10/10.
- Search by title, filter by format (TV, Movie, OVA, ONA, Special), and sort by my rating, date added, community score, release year or title.
- Click a poster to open its synopsis, scores and a link to the Kitsu page.
- Leaves out titles rated R.
- Follows the system light or dark theme.

## Stack

Plain HTML, CSS and JavaScript. No build step, no dependencies.

```
index.html
assets/
  css/style.css
  js/app.js
  img/
```

## Running locally

Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
```

## Using your own library

Change `USER_ID` at the top of `assets/js/app.js` to your Kitsu user ID. You can find it in the API response for your profile: `https://kitsu.io/api/edge/users?filter[slug]=<your-username>`.
