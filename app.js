/*
 * Lista de Deseos Maga Santa — página pública (una sola página, tres modos):
 *
 *   /            la clienta arma su lista (productos → datos → ¡lista!)
 *   /?c=CODIGO   la lista que ven los que regalan
 *   /?p=PRIVADO  el avance que ve solo la festejada
 *
 * Todo lo que viene del backend se pinta con textContent o escapado: nunca
 * se mete texto de una clienta como HTML.
 */
(function () {
  'use strict';

  const API = window.LISTAS_API;
  const $app = document.getElementById('app');
  const $pie = document.getElementById('pie');
  const $barra = document.getElementById('barra');
  const $aviso = document.getElementById('aviso');
  const params = new URLSearchParams(location.search);
  const BASE = location.origin + location.pathname;

  const estado = { cat: null, cant: {}, filtro: '', paso: 1, datos: {}, resultado: null };

  // ---------------------------------------------------------------- utiles
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
  const pct = (x) => Math.round((Number(x) || 0) * 100) + '%';
  const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function aviso(texto) {
    $aviso.textContent = texto;
    $aviso.hidden = false;
    clearTimeout(aviso._t);
    aviso._t = setTimeout(() => { $aviso.hidden = true; }, 2200);
  }

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); aviso('¡Copiado!'); }
    catch (e) { window.prompt('Copia este texto:', texto); }
  }

  async function pedir(query) {
    const r = await fetch(API + '?' + new URLSearchParams(query));
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Ocurrió un error.');
    return j;
  }

  async function enviar(cuerpo) {
    // text/plain: así el navegador no hace la consulta previa de CORS.
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Ocurrió un error.');
    return j;
  }

  function cabecera(titulo, bajada) {
    document.getElementById('titulo').textContent = titulo;
    document.getElementById('bajada').textContent = bajada || '';
  }

  function error(msg, conReintento) {
    $barra.hidden = true;
    $app.innerHTML =
      '<div class="tarjeta centro"><h2>Uy, algo no resultó</h2><p>' + esc(msg) + '</p>' +
      (conReintento ? '<button class="boton" onclick="location.reload()">Intentar de nuevo</button>' : '') +
      '<a class="boton claro" href="' + esc(BASE) + '">Ir al inicio</a></div>';
  }

  function pie(t) {
    const especial = (t.horario_especial || []).map((h) => '<li>' + esc(h) + '</li>').join('');
    $pie.innerHTML =
      '<div class="dentro">' +
      '<h3>Te esperamos en la tienda</h3>' +
      '<p>📍 <a href="' + esc(t.mapa_url) + '" target="_blank" rel="noopener">' + esc(t.direccion) + '</a></p>' +
      '<p>🕒 ' + esc(t.horario_normal) + '</p>' +
      (especial ? '<p><b>Horario de Navidad</b></p><ul>' + especial + '</ul>' : '') +
      '<div class="redes">' +
      '<a href="' + esc(t.whatsapp_link) + '" target="_blank" rel="noopener">WhatsApp ' + esc(t.whatsapp) + '</a>' +
      '<a href="https://www.instagram.com/' + esc(t.instagram) + '/" target="_blank" rel="noopener">Instagram @' + esc(t.instagram) + '</a>' +
      '<a href="' + esc(t.web) + '" target="_blank" rel="noopener">' + esc(String(t.web).replace(/^https?:\/\/(www\.)?/, '')) + '</a>' +
      '</div>' +
      '<p class="lema">Belleza natural y magia botánica desde Pucón 💛</p>' +
      '</div>';
    $pie.hidden = false;
  }

  function marcaPrueba() {
    if (window.LISTAS_AMBIENTE === 'pruebas') {
      const d = document.createElement('div');
      d.className = 'prueba';
      d.textContent = 'AMBIENTE DE PRUEBAS · las listas creadas aquí no llegan a la tienda';
      document.body.prepend(d);
    }
  }

  // ============================================================ 1. ARMAR ===

  async function iniciarArmar() {
    try {
      estado.cat = await pedir({ a: 'catalogo' });
    } catch (e) { return error(e.message, true); }
    const t = estado.cat.tienda;
    cabecera(t.slogan, t.bajada);
    pie(t);
    if (!estado.cat.abierta) {
      $app.innerHTML = '<div class="tarjeta centro"><h2>La campaña de listas ya cerró</h2>' +
        '<p>¡Gracias por tu interés! Te esperamos en la tienda.</p></div>';
      return;
    }
    pintarArmar();
  }

  function totalUnidades() {
    return Object.values(estado.cant).reduce((s, n) => s + n, 0);
  }

  function pasos(n) {
    return '<div class="pasos">' + ['Elige', 'Tus datos', '¡Lista!']
      .map((p, i) => '<span class="paso' + (i + 1 === n ? ' activo' : '') + '">' + (i + 1) + '. ' + p + '</span>').join('') + '</div>';
  }

  function pintarArmar() {
    if (estado.paso === 1) return pintarPaso1();
    if (estado.paso === 2) return pintarPaso2();
    return pintarPaso3();
  }

  function pintarPaso1() {
    const t = estado.cat.tienda;
    $app.innerHTML = pasos(1) +
      '<div class="destacado">🎁 Elige lo que te gustaría recibir. Quien te regale algo de tu lista tendrá <b>' +
      pct(t.pct_regalo) + ' de descuento</b>, y si te regalan más de <b>' + pesos(t.meta_premio) +
      '</b>, ganas un <b>' + pct(t.pct_cumple) + ' para tu mes de cumpleaños</b> ✨</div>' +
      '<input class="buscar" type="search" placeholder="Buscar producto…" aria-label="Buscar producto" value="' + esc(estado.filtro) + '">' +
      '<div id="lista-productos"></div>';
    const $b = $app.querySelector('.buscar');
    $b.addEventListener('input', () => { estado.filtro = $b.value; pintarProductos(); });
    pintarProductos();
    pintarBarra();
  }

  function pintarProductos() {
    const max = estado.cat.max_por_producto || 5;
    const f = plano(estado.filtro);
    const $l = document.getElementById('lista-productos');
    const visibles = estado.cat.productos.filter((p) => !f || plano(p.nombre).includes(f));
    if (!visibles.length) { $l.innerHTML = '<p class="chico centro">No encontramos productos con ese nombre.</p>'; return; }
    $l.innerHTML = visibles.map((p) => {
      const n = estado.cant[p.sku] || 0;
      return '<div class="producto' + (n ? ' elegido' : '') + '" data-sku="' + esc(p.sku) + '">' +
        '<div class="info"><div class="nombre">' + esc(p.nombre) + '</div>' +
        '<div class="precio">' + pesos(p.precio) + '</div></div>' +
        '<div class="cantidad">' +
        '<button type="button" data-d="-1" aria-label="Quitar uno"' + (n ? '' : ' disabled') + '>−</button>' +
        '<span>' + n + '</span>' +
        '<button type="button" data-d="1" aria-label="Agregar uno"' + (n >= max ? ' disabled' : '') + '>+</button>' +
        '</div></div>';
    }).join('');
    $l.querySelectorAll('.cantidad button').forEach((b) => b.addEventListener('click', () => {
      const sku = b.closest('.producto').dataset.sku;
      const n = Math.max(0, Math.min(max, (estado.cant[sku] || 0) + Number(b.dataset.d)));
      if (n) estado.cant[sku] = n; else delete estado.cant[sku];
      pintarProductos();
      pintarBarra();
    }));
  }

  function pintarBarra() {
    const n = totalUnidades();
    const distintos = Object.keys(estado.cant).length;
    $barra.innerHTML = '<div class="dentro"><div class="resumen">' +
      (n ? '<b>Tu lista:</b> ' + distintos + (distintos === 1 ? ' producto' : ' productos') +
           (n !== distintos ? ' (' + n + ' unidades)' : '') : 'Elige tus productos') +
      '</div><button class="boton" type="button"' + (n ? '' : ' disabled') + '>Continuar →</button></div>';
    $barra.hidden = false;
    $barra.querySelector('button').addEventListener('click', () => {
      estado.paso = 2; pintarArmar(); window.scrollTo(0, 0);
    });
  }

  function opcionesNumero(desde, hasta, elegido, nombres) {
    let s = '<option value="">—</option>';
    for (let i = desde; i <= hasta; i++) {
      s += '<option value="' + i + '"' + (String(elegido) === String(i) ? ' selected' : '') + '>' + (nombres ? nombres[i - 1] : i) + '</option>';
    }
    return s;
  }

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function pintarPaso2() {
    $barra.hidden = true;
    const d = estado.datos;
    const elegidos = estado.cat.productos.filter((p) => estado.cant[p.sku]);
    const venc = estado.cat.vencimientos;
    if (!d.vence && venc.length) d.vence = venc[0].valor;
    $app.innerHTML = pasos(2) +
      '<div class="tarjeta"><h2>Tu lista</h2>' +
      elegidos.map((p) => '<p>' + estado.cant[p.sku] + ' × ' + esc(p.nombre) + '</p>').join('') +
      '<button class="boton texto" type="button" id="volver">← Cambiar productos</button></div>' +
      '<form class="tarjeta" id="form" novalidate><h2>Tus datos</h2>' +
      '<div class="fila"><div class="campo"><label for="nombre">Nombre</label><input id="nombre" type="text" autocomplete="given-name" maxlength="40" value="' + esc(d.nombre) + '"></div>' +
      '<div class="campo"><label for="apellido">Apellido</label><input id="apellido" type="text" autocomplete="family-name" maxlength="40" value="' + esc(d.apellido) + '"></div></div>' +
      '<div class="campo"><label for="whatsapp">WhatsApp</label><div class="prefijo"><span>+56</span>' +
      '<input id="whatsapp" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="9 1234 5678" maxlength="15" value="' + esc(d.whatsapp) + '"></div></div>' +
      '<div class="campo"><span class="rotulo">Tu cumpleaños <span class="chico">(para tu premio; no pedimos el año)</span></span>' +
      '<div class="fila"><select id="dia" aria-label="Día">' + opcionesNumero(1, 31, d.cumple_dia) + '</select>' +
      '<select id="mes" aria-label="Mes">' + opcionesNumero(1, 12, d.cumple_mes, MESES) + '</select></div></div>' +
      '<div class="campo"><label for="email">Correo electrónico <span class="chico">(opcional)</span></label>' +
      '<input id="email" type="email" inputmode="email" autocomplete="email" placeholder="nombre@gmail.com" maxlength="100" value="' + esc(d.email) + '"></div>' +
      '<div class="campo"><span class="rotulo">Mi lista vale hasta</span><div class="opciones">' +
      venc.map((v) => '<label><input type="radio" name="vence" value="' + esc(v.valor) + '"' + (d.vence === v.valor ? ' checked' : '') + '> el ' + esc(v.texto) + '</label>').join('') +
      '</div></div>' +
      '<label class="check"><input type="checkbox" id="acepta_datos"' + (d.acepta_datos ? ' checked' : '') + '>' +
      '<span>Acepto que Maga Santa guarde mis datos para gestionar mi lista de deseos.</span></label>' +
      '<label class="check"><input type="checkbox" id="acepta_novedades"' + (d.acepta_novedades ? ' checked' : '') + '>' +
      '<span>Quiero recibir novedades y promociones de Maga Santa <span class="chico">(opcional)</span>.</span></label>' +
      '<div id="error" class="error" hidden></div>' +
      '<button class="boton" type="submit" id="crear">Crear mi lista ✨</button></form>';

    document.getElementById('volver').addEventListener('click', () => { leerForm(); estado.paso = 1; pintarArmar(); });
    document.getElementById('form').addEventListener('submit', crear);
  }

  function leerForm() {
    const v = (id) => document.getElementById(id);
    const r = document.querySelector('input[name=vence]:checked');
    Object.assign(estado.datos, {
      nombre: v('nombre').value.trim(), apellido: v('apellido').value.trim(), whatsapp: v('whatsapp').value.trim(),
      cumple_dia: v('dia').value, cumple_mes: v('mes').value, email: v('email').value.trim(),
      vence: r ? r.value : '', acepta_datos: v('acepta_datos').checked, acepta_novedades: v('acepta_novedades').checked,
    });
    return estado.datos;
  }

  function validar(d) {
    if (!d.nombre) return 'Escribe tu nombre.';
    if (!d.apellido) return 'Escribe tu apellido.';
    if (String(d.whatsapp).replace(/\D/g, '').length < 8) return 'Escribe tu WhatsApp (por ejemplo 9 1234 5678).';
    if (!d.cumple_dia || !d.cumple_mes) return 'Elige el día y el mes de tu cumpleaños.';
    if (d.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(d.email)) return 'Revisa tu correo electrónico (por ejemplo nombre@gmail.com).';
    if (!d.vence) return 'Elige hasta qué fecha vale tu lista.';
    if (!d.acepta_datos) return 'Para crear tu lista necesitamos que aceptes el uso de tus datos.';
    return '';
  }

  async function crear(ev) {
    ev.preventDefault();
    const d = leerForm();
    const $e = document.getElementById('error');
    const $b = document.getElementById('crear');
    const msg = validar(d);
    if (msg) { $e.textContent = msg; $e.hidden = false; return; }
    $e.hidden = true;
    $b.disabled = true; $b.textContent = 'Creando tu lista…';
    try {
      estado.resultado = await enviar(Object.assign({ a: 'crear' }, d, {
        cumple_dia: Number(d.cumple_dia), cumple_mes: Number(d.cumple_mes),
        items: Object.keys(estado.cant).map((sku) => ({ sku: sku, cantidad: estado.cant[sku] })),
      }));
      estado.paso = 3;
      pintarArmar();
      window.scrollTo(0, 0);
    } catch (e) {
      $e.textContent = e.message; $e.hidden = false;
      $b.disabled = false; $b.textContent = 'Crear mi lista ✨';
    }
  }

  function linkLista(codigo) { return BASE + '?c=' + encodeURIComponent(codigo); }
  function linkMi(privado) { return BASE + '?p=' + encodeURIComponent(privado); }

  function mensajeCompartir(codigo, venceTexto) {
    const t = estado.cat ? estado.cat.tienda : null;
    const dir = t && t.direccion ? ' (' + t.direccion + ')' : '';
    return '¡Hola! 🎄 Armé mi lista de deseos en Maga Santa ✨\n' +
      'Si quieres regalarme algo, aquí ves lo que pedí y lo que ya me regalaron:\n' + linkLista(codigo) + '\n\n' +
      '🎁 En la tienda' + dir + ' muestra mi código *' + codigo + '* y tienes *' + (t ? pct(t.pct_regalo) : '15%') +
      ' de descuento* en lo de mi lista' + (venceTexto ? ', hasta el ' + venceTexto : '') + ' 💚';
  }

  function pintarPaso3() {
    const r = estado.resultado;
    const t = estado.cat.tienda;
    const wa = 'https://wa.me/?text=' + encodeURIComponent(mensajeCompartir(r.codigo, r.vence_texto));
    const numero = '56' + String(estado.datos.whatsapp).replace(/\D/g, '').replace(/^56/, '');
    const paraMi = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(
      '✨ *Mi lista de deseos · Maga Santa*\n' +
      'Código: *' + r.codigo + '* · vale hasta el ' + r.vence_texto + '\n\n' +
      '🔒 *Mi avance y mi premio* (solo para mí, no reenviar este mensaje):\n' + linkMi(r.codigo_privado) + '\n\n' +
      '🎁 *Para compartir con mis cercanos:*\n' + linkLista(r.codigo));
    cabecera('¡Tu lista está lista, ' + r.nombre.split(' ')[0] + '!', 'Guárdala y compártela con quienes te quieren 💚');
    $app.innerHTML = pasos(3) +
      '<div class="tarjeta centro"><p class="chico">Tu código</p><div class="codigo">' + esc(r.codigo) + '</div>' +
      '<p class="chico">Vale hasta el ' + esc(r.vence_texto) + '. Quien te regale lo muestra en la tienda y tiene ' + pct(t.pct_regalo) + ' de descuento.</p></div>' +
      '<div class="tarjeta guardar"><h2>1. Guarda tu lista 🔒</h2>' +
      '<p class="destacado"><b>Importante:</b> envíatela a tu propio WhatsApp. Ese mensaje es <b>tu única forma de volver</b> a ver tu lista, ' +
      'cuántos regalos llevas y si ganaste tu ' + pct(t.pct_cumple) + ' de cumpleaños.</p>' +
      '<a class="boton wa" id="guardarMi" href="' + esc(paraMi) + '" target="_blank" rel="noopener">Guardar en mi WhatsApp</a>' +
      '<p class="chico">Te llega un mensaje con tu link privado. No lo compartas: ahí ves tu avance (sin saber qué te regalaron, ¡es sorpresa!).</p>' +
      '<a class="boton texto" href="' + esc(linkMi(r.codigo_privado)) + '">Ver mi avance ahora</a></div>' +
      '<div class="tarjeta centro"><h2>2. Compártela 💚</h2>' +
      '<p class="chico">Mándala a quienes te quieren. Ellos ven lo que pediste, pero no tu avance.</p>' +
      '<a class="boton wa" href="' + esc(wa) + '" target="_blank" rel="noopener">Compártela por WhatsApp</a>' +
      '<button class="boton claro" type="button" id="copiar">Copiar link</button></div>';
    document.getElementById('copiar').addEventListener('click', () => copiar(linkLista(r.codigo)));
    document.getElementById('guardarMi').addEventListener('click', function () {
      this.textContent = '✓ Enviado a mi WhatsApp (toca para enviar otra vez)';
    });
  }

  // ========================================================= 2. COMPARTIDA ===

  async function iniciarCompartida(codigo) {
    let j;
    try { j = await pedir({ a: 'lista', codigo: codigo }); } catch (e) { cabecera('Lista de Deseos'); return error(e.message, false); }
    const l = j.lista, t = j.tienda;
    cabecera('La lista de deseos de ' + l.nombre, t.frase_compartida);
    pie(t);
    if (!l.vigente) {
      $app.innerHTML = '<div class="tarjeta centro"><h2>Esta lista ya cerró</h2>' +
        '<p>Valía hasta el ' + esc(l.vence_texto) + '. Igual te esperamos en la tienda 💚</p></div>' + invitacion();
      return;
    }
    const disponibles = l.items.filter((i) => i.quedan > 0).length;
    $app.innerHTML =
      '<div class="tarjeta centro"><p>Ven a la tienda, muestra este código y llévate <b>' + pct(t.pct_regalo) +
      ' de descuento</b> en lo que regales de esta lista.</p>' +
      '<div class="codigo">' + esc(l.codigo) + '</div>' +
      '<p class="chico">Válida hasta el ' + esc(l.vence_texto) + '</p></div>' +
      (disponibles ? '' : '<div class="destacado centro">¡Ya le regalaron todo lo de su lista! 🎉</div>') +
      l.items.map((i) => {
        const listo = i.quedan <= 0;
        return '<div class="producto' + (listo ? ' regalado' : '') + '"><div class="info">' +
          '<div class="nombre">' + esc(i.nombre) + '</div>' +
          (listo ? '<span class="etiqueta listo">Ya regalado ✓</span>' :
            '<div class="precio"><s>' + pesos(i.precio) + '</s><b>' + pesos(i.precio_lista) + '</b> con tu descuento</div>' +
            '<span class="etiqueta ok">Disponible' + (i.pedida > 1 ? ' · quedan ' + i.quedan + ' de ' + i.pedida : '') + '</span>') +
          '</div></div>';
      }).join('') +
      '<p class="chico centro">La lista se actualiza sola: lo que ya se regaló aparece marcado.</p>' + invitacion();
  }

  function invitacion() {
    return '<div class="tarjeta centro"><h2>¿Quieres tu propia lista?</h2>' +
      '<p>Arma la tuya en un minuto y deja que te sorprendan ✨</p>' +
      '<a class="boton claro" href="' + esc(BASE) + '">Armar mi lista</a></div>';
  }

  // ============================================================ 3. MI LISTA ===

  async function iniciarMi(privado) {
    let j;
    try { j = await pedir({ a: 'mi', p: privado }); } catch (e) { cabecera('Mi lista'); return error(e.message, false); }
    const m = j.mi, t = j.tienda, pr = m.premio;
    cabecera('Hola, ' + m.nombre + ' ✨', 'Este es tu rincón privado: aquí ves cómo va tu lista.');
    pie(t);
    const avance = pr.meta ? Math.min(100, Math.round((pr.meta + 1 - pr.falta) / (pr.meta + 1) * 100)) : 0;
    let premio;
    if (pr.estado === 'PENDIENTE') {
      premio = '<p>Te faltan <b>' + pesos(pr.falta) + '</b> en regalos para ganar tu <b>' + pct(pr.pct) +
        ' de descuento</b> en tu mes de cumpleaños (' + esc(pr.mes_texto) + ').</p>' +
        '<div class="avance"><div style="width:' + avance + '%"></div></div>' +
        '<p class="chico">Mientras más compartas tu lista, más cerca estás 💛</p>';
    } else if (pr.estado === 'USADO') {
      premio = '<p>Ya usaste tu ' + pct(pr.pct) + ' de cumpleaños. ¡Esperamos que lo hayas disfrutado!</p>';
    } else if (pr.estado === 'VENCIDO') {
      premio = '<p>Tu ' + pct(pr.pct) + ' de cumpleaños era para ' + esc(pr.mes_texto) + ' y ya pasó.</p>';
    } else {
      premio = '<p class="grande">🎉 ¡Ganaste!</p><p>Tienes <b>' + pct(pr.pct) + ' de descuento</b> para una compra en tu mes de cumpleaños (<b>' +
        esc(pr.mes_texto) + '</b>). ' + (pr.estado === 'ACTIVO' ? '<b>¡Ya lo puedes usar!</b> ' : '') +
        'Muestra tu código en la tienda.</p><div class="avance"><div style="width:100%"></div></div>';
    }
    estado.cat = { tienda: t };
    const wa = 'https://wa.me/?text=' + encodeURIComponent(mensajeCompartir(m.codigo, m.vence_texto));
    $app.innerHTML =
      '<div class="tarjeta centro"><p class="chico">Regalos recibidos</p><p class="grande">' + m.unidades_regaladas + '</p>' +
      '<p class="chico">de ' + m.productos_pedidos + ' que pediste · qué te regalaron es sorpresa 🤫</p></div>' +
      '<div class="tarjeta"><h2>Tu premio de cumpleaños</h2>' + premio + '</div>' +
      '<div class="tarjeta centro"><p class="chico">Tu código</p><div class="codigo">' + esc(m.codigo) + '</div>' +
      '<p class="chico">' + (m.vigente ? 'Tu lista vale hasta el ' + esc(m.vence_texto) + '.' : 'Tu lista cerró el ' + esc(m.vence_texto) + '.') + '</p>' +
      (m.vigente ? '<a class="boton wa" href="' + esc(wa) + '" target="_blank" rel="noopener">Compartir mi lista otra vez</a>' +
                   '<button class="boton claro" type="button" id="copiar">Copiar link de mi lista</button>' : '') +
      '</div>';
    const $c = document.getElementById('copiar');
    if ($c) $c.addEventListener('click', () => copiar(linkLista(m.codigo)));
  }

  // ---------------------------------------------------------------- arranque
  marcaPrueba();
  if (!API) { error('La página no está configurada.', false); return; }
  if (params.get('p')) iniciarMi(params.get('p'));
  else if (params.get('c')) iniciarCompartida(params.get('c'));
  else iniciarArmar();
})();
