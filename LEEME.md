# Página pública de la Lista de Deseos

Página estática (HTML + CSS + JS, sin compilar) que se publica en GitHub Pages
en un repositorio **público aparte**, con solo esta carpeta. No contiene datos
de clientas: todo se pide al backend (proyecto Apps Script "Listas").

- `index.html`, `estilos.css`, `app.js`: la página (tres modos: armar, `?c=` lista compartida, `?p=` mi lista).
- `config.js`: URL del backend y ambiente. **Al pasar a la tienda, cambiar la URL y poner `LISTAS_AMBIENTE = 'tienda'`** (así desaparece la franja amarilla de pruebas).
- `logo.png`: sale de `Logo.gs`.

Probar en el PC: servidor `lista-deseos-web` (python -m http.server 8765 sobre esta carpeta).
