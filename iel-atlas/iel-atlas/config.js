/* Indian Electronic Literature Atlas: site settings.
   Edit this file after uploading; no other file needs changing. */
window.IEL_CONFIG = {
  // Base layer shown first: 'map' (street/terrain map), 'sat' (live satellite) or 'offline' (built-in NASA image).
  defaultBase: 'map',
  // Map view shown first: 'clusters' (grouped markers, like the African e-lit map) or 'states' (shaded states).
  defaultMode: 'clusters',

  // Street/terrain map. Esri World Topographic works without a key. For the MapTiler look used by the
  // African E-Lit database, create a free key at maptiler.com and paste it here:
  mapTilerKey: '',
  mapTilerStyle: 'streets-v2',

  // Live satellite tiles. Esri World Imagery works without a key for modest, non-commercial traffic;
  // check Esri's terms for your use, or swap in another provider (e.g. MapTiler with your API key):
  //   'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=YOUR_KEY'
  satelliteTiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  satelliteAttribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  labelTiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',

  // Submissions. Leave empty to offer copy/download only.
  submitEmail: 'contact.icidn@gmail.com',   // adds an "Email to the editors" button; set to '' to hide it
  submitEndpoint: ''      // e.g. a Formspree/Getform URL adds a "Send to the editors" button (POSTs JSON)
};
