/** Ligações para contacto. Abrir a ligação NÃO significa que a mensagem foi enviada. */
export function AcoesTelefone({ e164 }: { e164: string }) {
  const digitos = e164.replace(/\D/g, '')
  return (
    <span className="acoes-contacto">
      <a href={`tel:${e164}`} className="acao-contacto" aria-label={`Ligar para ${e164}`}>
        Ligar
      </a>
      <a
        href={`https://wa.me/${digitos}`}
        target="_blank"
        rel="noopener noreferrer"
        className="acao-contacto"
        aria-label={`Abrir conversa WhatsApp com ${e164}`}
      >
        WhatsApp
      </a>
    </span>
  )
}

export function AcaoEmail({ email }: { email: string }) {
  return (
    <span className="acoes-contacto">
      <a href={`mailto:${email}`} className="acao-contacto" aria-label={`Escrever para ${email}`}>
        Email
      </a>
    </span>
  )
}
