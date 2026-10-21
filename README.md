# Preventive Monitoring Template

Static GitHub Pages application that offers (1) a visual exact-copy DOCX of pages 1–3 and (2) an editable wizard that creates a similar three-page Word document in the browser.

## Files
- `index.html`, `styles.css`, `app.js`: web app.
- `Application_Monitoring_Exact_Copy_Pages_1-3.docx`: image-based, visual-copy Word document generated from rendered pages 1–3 of the supplied source.
- `assets/reference-page-1.png` through `assets/reference-page-3.png`: preview images.

## Run locally
Open `index.html` in Microsoft Edge. The editable generator loads the `docx` JavaScript library from a CDN, so an internet connection is needed for that feature. The exact-copy download and preview assets are local.

For a local web server, run `python -m http.server 8000` from this folder and visit `http://localhost:8000`.

## Deploy to GitHub Pages
1. Create a repository and add the files in this folder to its root.
2. Open **Settings → Pages**.
3. Under build and deployment, choose **Deploy from a branch**.
4. Select the branch (for example, `main`) and folder `/ (root)`, then save.
5. Wait for GitHub Pages to publish the site.

All local asset paths are relative so the site works from a repository subpath.

## Fidelity notes
- The **exact-copy** DOCX uses full-page raster images of the source document's first three rendered pages. This prioritizes visual fidelity, but its page text is not editable or searchable.
- The **editable wizard** creates editable text, but it reconstructs the layout and is not a pixel-perfect clone. Pagination and typography can vary by Word/LibreOffice version and installed fonts. Review the result before official use.
- The reference file is marked Restricted and contains a proprietary/confidentiality notice. Do not put this app, the DOCX, or preview images in a public repository unless you are authorized to disclose them. Use a private repository and confirm your organization's sharing rules.
