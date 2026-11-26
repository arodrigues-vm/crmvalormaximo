import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoTexto } from '../../componentes/campos'
import { CampoResponsavel } from '../../componentes/CampoResponsavel'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { dataPt } from '../../componentes/formatar'
import { comoRegistoCp, usePersonalizados } from '../../componentes/personalizados'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { planosApi, type Plano } from './api'
import { ECRA_PLANO } from './disposicao'

export function PlanoEditar() {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['planos-marketing', id], queryFn: () => planosApi.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Plano não encontrado ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar este plano.</p>
  return <Formulario key={data.versao} plano={data} />
}

function Formulario({ plano }: { plano: Plano }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const base0 = useMemo(() => ({ responsavel: String(plano.responsavel), observacoes: plano.observacoes }), [plano])
  const [v, setV] = useState(base0)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const cp = usePersonalizados(ECRA_PLANO, comoRegistoCp(plano))
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(base0) || cp.alterado)

  async function submeter(e: FormEvent) {
    e.preventDefault()
    try {
      const r = await planosApi.atualizar(plano.id, {
        responsavel: Number(v.responsavel),
        observacoes: v.observacoes,
        campos_personalizados: cp.paraApi(),
        versao: plano.versao,
      })
      guarda.libertar()
      qc.setQueryData(['planos-marketing', String(r.id)], r)
      qc.invalidateQueries({ queryKey: ['planos-marketing', 'lista'] })
      navegar(`/marketing-imoveis/${r.id}`)
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos as Record<string, string[]>)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    }
  }

  const leitura = (rotulo: string, valor: string) => <CampoTexto rotulo={rotulo} value={valor} disabled readOnly />
  function desenharCampo(k: string): ReactNode {
    switch (k) {
      case 'imovel':
        return leitura('Imóvel', plano.imovel_descricao)
      case 'angariacao':
        return leitura('CMI', plano.angariacao_referencia)
      case 'data_base':
        return leitura('Data-base (início do CMI)', dataPt(plano.data_base) ?? '')
      case 'responsavel':
        return (
          <CampoResponsavel
            modulo="marketing-imoveis"
            valor={v.responsavel}
            atual={{ id: plano.responsavel, nome: plano.responsavel_nome }}
            aoMudar={(x) => setV((a) => ({ ...a, responsavel: x }))}
            erro={erros.responsavel}
          />
        )
      case 'observacoes':
        return (
          <CampoAreaTexto
            rotulo="Observações"
            value={v.observacoes}
            onChange={(e) => setV((a) => ({ ...a, observacoes: e.target.value }))}
          />
        )
    }
    return null
  }

  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      <CabecalhoRegisto
        modulo="Plano de Marketing de Imóveis"
        caminho="/marketing-imoveis"
        referencia={plano.referencia}
        titulo="Editar plano"
      />
      <p className="ajuda">O responsável do plano não muda o das tarefas já criadas: esse muda-se em cada tarefa.</p>
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}
      <BlocosConfiguraveis def={ECRA_PLANO} modo="editar" personalizados={cp} campo={desenharCampo} erros={erros} />
      <div className="barra-gravar">
        <button type="button" className="botao-secundario" onClick={() => navegar(`/marketing-imoveis/${plano.id}`)}>
          Cancelar
        </button>
        <button type="submit" className="botao-principal">
          Guardar
        </button>
      </div>
      {guarda.dialogo}
    </form>
  )
}
