# Chasov Yar asset

Place the licensed Chasov Yar raster at `public/maps/chasov-yar.jpg` before publishing a build. It is loaded at runtime as `./maps/chasov-yar.jpg` by `src/map-mode.js`.

Source: ULTRV / Chasov Yar, exported from the author's mod. The original file is not yet included in this pull request. In the absence of this JPEG, the map still opens in GRID mode, but the backdrop is missing.

The 6144 m scale is derived from the terrain grid and **map-image georeferencing is not independently verified**. Gun and target Z remain manual. Do not change the verified ballistic core.
