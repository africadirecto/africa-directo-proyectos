// Confirmación con el aspecto de la app, en lugar de la ventana del navegador (window.confirm).
//
//   if (!(await confirmar('¿Quitar el acceso a Ana? No podrá entrar.'))) return;
//
// Es un <dialog> que se crea en el momento, así que no hace falta montar nada en la página y
// funciona también encima de otro diálogo abierto. Escape o pulsar fuera equivalen a cancelar.
// Si el mensaje empieza por una pregunta, esa es el título y el resto, la explicación.

export interface OpcionesConfirmar {
  /** Texto de los botones (por defecto, «Aceptar» y «Cancelar»). */
  aceptar?: string;
  cancelar?: string;
  /** El botón de aceptar, en rojo: para lo que elimina o quita algo. */
  peligro?: boolean;
}

function partes(mensaje: string): { titulo: string; resto: string } {
  const fin = mensaje.indexOf('?');
  if (fin < 0 || mensaje.slice(0, fin).includes('. ')) return { titulo: '', resto: mensaje };
  return { titulo: mensaje.slice(0, fin + 1).trim(), resto: mensaje.slice(fin + 1).trim() };
}

export function confirmar(mensaje: string, { aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false }: OpcionesConfirmar = {}): Promise<boolean> {
  return new Promise((resolver) => {
    const { titulo, resto } = partes(mensaje);
    const crear = <K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase: string, texto = '') => {
      const el = document.createElement(etiqueta);
      el.className = clase;
      el.textContent = texto;
      return el;
    };
    const dialogo = crear('dialog', 'dialogo dialogo-confirmar');
    dialogo.setAttribute('role', 'alertdialog');
    dialogo.setAttribute('aria-label', titulo || mensaje);
    const cuerpo = crear('div', 'cuerpo');
    if (titulo) cuerpo.append(crear('h2', '', titulo));
    if (resto) cuerpo.append(crear('p', 'confirmar-texto', resto));
    const botones = crear('div', 'botones');
    const no = crear('button', 'btn btn-s', cancelar);
    const si = crear('button', peligro ? 'btn btn-d' : 'btn btn-p', aceptar);
    no.type = si.type = 'button';
    // Se responde en el momento, sin esperar al evento «close» del diálogo (que puede tardar).
    let respondido = false;
    const responder = (valor: boolean) => {
      if (respondido) return;
      respondido = true;
      if (dialogo.open) dialogo.close();
      dialogo.remove();
      resolver(valor);
    };
    no.onclick = () => responder(false);
    si.onclick = () => responder(true);
    botones.append(no, si);
    cuerpo.append(botones);
    dialogo.append(cuerpo);
    // Pulsar fuera (en el fondo) o Escape cancelan.
    dialogo.onclick = (e) => e.target === dialogo && responder(false);
    dialogo.oncancel = () => responder(false);
    dialogo.onclose = () => responder(false);
    document.body.append(dialogo);
    dialogo.showModal();
    si.focus();
  });
}
