# Indian Electronic Literature Atlas — an ICIDN project

A static website (no database or server code) that lives inside the ICIDN site at `projects/iel-atlas/`
and is linked from ICIDN's Projects page.

## Adding it to the ICIDN website (icidn/website repository)

1. Copy the `projects/` folder from this package into the root of the `icidn/website` repository,
   so the Atlas sits at `projects/iel-atlas/index.html`.
2. Replace the repository's `projects.html` with the one in this package. It shows the Projects grid,
   adds the Atlas card, keeps the "What Is Electronic Literature?" call as a card, and fixes a CSS typo
   that hid the ICIDN title in the header.
3. Commit and push. GitHub Pages publishes it at
   https://icidn.github.io/website/projects/iel-atlas/ within a few minutes.

The Atlas links back to ICIDN with absolute addresses (https://icidn.github.io/website/...), so it also
works if hosted on its own. If ICIDN moves to a custom domain, search and replace
`https://icidn.github.io/website/` in `index.html`.

## Folder layout

```
index.html                     Page markup (all sections: Atlas, Works, Scholarship, Scholars, Timeline, Collections, About, Submit)
assets/css/style.css           All styling, light and dark themes
assets/js/config.js            Settings you edit: map tiles, submission email/endpoint
assets/js/app.js               Application logic (routing, map, search, filters, timeline, dialogs, downloads)
assets/data/atlas-data.js      Works + scholarship + scholars + activities (window.IEL_DATA)
assets/data/india-states.js    State boundaries with label points (window.IEL_STATES)
assets/img/india-satellite-offline.jpg   Built-in NASA image, used if live tiles fail
assets/vendor/leaflet/         Leaflet 1.9.4 (map library), bundled so no CDN is needed
data/                          Source spreadsheets for download
```

## Hosting

- **GitHub Pages (ICIDN)**: see "Adding it to the ICIDN website" above.
- **Netlify / Vercel / Cloudflare Pages**: drag the folder into the dashboard.
- **University or cPanel hosting**: upload the folder contents into `public_html` (or a subfolder).
- **Local preview**: double-click `index.html`, or run `python3 -m http.server` in this folder and open http://localhost:8000.

## Live satellite map

The Atlas uses Leaflet with Esri World Imagery (live, zoomable to street level), an OpenStreetMap street layer,
optional place-name labels, and a built-in NASA image as an automatic fallback. Change providers in `assets/js/config.js`.
Esri's basemaps are free for modest non-commercial use with attribution; for heavy or commercial traffic, use a keyed
provider such as MapTiler and paste its tile URL into `satelliteTiles`.

Boundary note: the coloured state outlines come from DataMeet's India maps. Third-party base tiles may draw
international borders differently.

## Updating the data

`assets/data/atlas-data.js` holds plain JSON after `window.IEL_DATA =`. Each work has fields such as `title`, `author`,
`date`, `year`, `lang`, `medium`, `family`, `coll`, `region`, `states` (list of state names used by the map), `url`,
`desc`, `tags`, `ref` (non-Indian reference item) and `isPlatform`. Scholarship records carry `id`, `authors`, `year`,
`title`, `type`, `container`, `doi`, `url`, `abstract`, `keywords`, `scope`, `status` and `states`.
To place a work on the map, add its state (spelled as on the map, e.g. "Tamil Nadu") to `states`.

## Submissions

Set `submitEmail` for a mail-to button, or `submitEndpoint` to a form service (Formspree, Getform, a Google Apps Script
web app) to receive entries as JSON. Without either, contributors can copy or download their entry.

## Credits

Works data: Indian Electronic Literature Master Dataset (Mehulkumar Desai & Shanmugapriya T).
Scholarship data: IEL Scholarship Repository. Boundaries © DataMeet (ODbL). Imagery © Esri and contributors;
© OpenStreetMap contributors; NASA Blue Marble (public domain). Map library: Leaflet (BSD-2).
