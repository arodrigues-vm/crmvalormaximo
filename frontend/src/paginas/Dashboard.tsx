import { useQuery } from '@tanstack/react-query'

import { obterSaude } from '../api/cliente'

export function Dashboard() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['saude'], queryFn: obterSaude })

  let estado = 'A verificar…'
  if (isError) estado = 'Servidor indisponível'
  else if (data) estado = data.estado === 'ok' ? 'Operacional' : 'Base de dados indisponível'

  return (
    <section className="cartao">
      <h2>Bem-vindo ao CRM Valor Máximo</h2>
      <p className="assinatura">Mais valor para o seu futuro</p>
      <dl className="estado-sistema">
        <dt>Estado do sistema</dt>
        <dd data-testid="estado-sistema">{isLoading ? 'A verificar…' : estado}</dd>
        {data && (
          <>
            <dt>Ambiente</dt>
            <dd>{data.ambiente}</dd>
          </>
        )}
      </dl>
    </section>
  )
}
