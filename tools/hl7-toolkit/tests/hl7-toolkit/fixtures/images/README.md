# Image Sanitize fixtures

The actual-browser Image Sanitize check creates its 8 × 6 PNG and JPEG inputs in browser memory. It injects synthetic metadata canaries, redacts synthetic solid-color pixels, and discards the inputs when the browser session ends.

No patient images, screenshots, DICOM objects, or generated raster fixture files are stored in this directory or included in workstation packages.
