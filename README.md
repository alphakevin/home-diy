# Range Hood Installation · 3D Space Planning

English version: this file. 中文说明：[README.zh-CN.md](README.zh-CN.md)

Live preview: https://alphakevin.github.io/home-diy/

GitHub Pages publishes from the root of the `gh-pages` branch. After updating `dist/` on `main`, sync the site with:

```sh
git subtree split --prefix=dist -b pages-release
git push origin pages-release:gh-pages
git branch -D pages-release
```

On first setup, GitHub Actions may return a server error when starting the app, so branch-based publishing is used.

This is a standalone static webpage built with Three.js 0.170.0. Dependencies are included under `dist/vendor`, so no CDN access is required at runtime.

## Local Run

After installing Node.js, run `npm start` in this directory and open http://127.0.0.1:4173 . You can also host `dist` with any static HTTP server; do not open the HTML directly by double-clicking it (browsers restrict ES modules in this case).

## Interaction

- Drag to rotate, scroll to zoom, and right-drag to pan; quick views for isometric, front, and side elevations.
- Click the center cabinet door or use the control panel to switch angles from 0–110°.
- Hide the removable ducting plate to view the machine housing; show the original movable bottom panel to inspect interference.
- Installation and cabinet dimensions are labeled; the cooking appliance reference height and cabinet-to-floor gap can be adjusted.
- You can switch the measurement baseline between the hood upper edge and the lowest edge to verify the installation drawing. The initial values follow the current discussion and are not a substitute for manufacturer confirmation.

## Dimensions and Modeling Boundaries

All calculations use mm, and the Three.js scene uses 1 unit = 1 m. The countertop top surface is y=0, the wall is z=0, and the centerline is x=0.

Known cabinet: net width 760, depth 380, height 700, cabinet bottom to countertop 865, horizontal bar height 80, clearance below bar 192.

Product drawing: range hood width 896, depth 470, total height 688 (excluding the outlet); upper section width 365, depth 325, height 496; lower section height 192; range hood duct label 220.

Initial tentative setup: cooking appliance reference height above counter 100, hood upper edge 8 below cabinet bottom. This places the upper edge 857 above the countertop, 757 above the cooking reference, and 212 mm clearance above the cabinet top.

The original movable bottom panel is removed by default; the trim panel is shown as a concept finish size of 754 × 186 × 18 (corresponding to the 760 × 192 opening, leaving 3 mm gaps on each side). Final cutting must be re-measured.

Panel thickness, side cabinet width, appliance shape, duct path, top panel cutouts, hardware, and bracket are illustrative only; geometry is not used for fabrication or mounting hole positioning. It does not automatically determine load-bearing capacity, fire clearance, actual cabinet door hardware travel, or duct bend feasibility. The measurement reference for both ends of the cooking appliance and equipment must be confirmed against the random installation manual.

## Project Files

- `dist/index.html`: interface
- `dist/styles.css`: responsive layout
- `dist/app.js`: parameterized model, dimension annotations, and interaction
- `dist/vendor/`: Three.js and official OrbitControls
- `serve.mjs`: local server with no third-party dependencies

Three.js official docs: https://threejs.org/docs/ . Third-party code uses the MIT license, see `dist/vendor/LICENSE.three`.

## Product Detail Revisions

Based on supplementary photos and side-view installation drawings, a rounded cabinet body, touch strip, recessed smoke cavity, sloped smoke-guiding plate, and rear oil cup were added; the side wall was corrected to a continuous diagonal from 60 mm from the front edge to 192 mm at the rear, and the outlet center distance from the wall is 142 mm. An independent "Product" observation view was added. Internal components, small radii, icons, and logos are approximations based on photos, not manufacturing drawings.

The supplementary installation drawing clarifies that 720–800 mm is only suitable for electric cooktops; gas cooktops should use the height specified in the gas cooktop manual. The interface only calculates distances and no longer determines the current gas-cooktop scheme based on that range.
