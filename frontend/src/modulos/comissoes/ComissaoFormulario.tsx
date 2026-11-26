import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis, Largo } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoCaixa, CampoTexto } from '../../componentes/campos'
import { CampoResponsavel } from '../../componentes/CampoResponsavel'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { formatarEuros } from '../../componentes/formatar'
import { comoRegistoCp, usePersonalizados } from '../../componentes/personalizados'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { comissoesApi, NOMES_LADO, type Comissao, type Lado } from './api'
import { ECRA_COMISSAO } from './disposicao'

interface Linha {
  lado: Lado
  utilizador: string
  modo: '' | 'percentagem' | 'deducao'
  percentagem: string
  deducao: string
}

const n = (v: string | null) => (v === null ? '' : String(Number(v)))
const dec = (v: string) => (v.trim() ? v.trim().replace(',', '.') : null)

export function ComissaoEditar() {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['comissoes', id], queryFn: () => comissoesApi.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Comissão não encontrada ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar esta comissão.</p>
  return <Formulario c={data} key={data.versao} />
}

function Formulario({ c }: { c: Comissao }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const opcoes = useQuery({ queryKey: ['comissoes', 'opcoes'], queryFn: comissoesApi.opcoes, staleTime: 60_000 })
  const inicial = useMemo(
    () => ({
      pct_angariacao: n(c.pct_angariacao),
      lado_angariacao_nosso: c.lado_angariacao_nosso,
      lado_venda_nosso: c.lado_venda_nosso,
      valor_final: n(c.valor_final),
      responsavel: String(c.responsavel),
      observacoes: c.observacoes,
      linhas: c.beneficiarios.map<Linha>((b) => ({
        lado: b.lado,
        utilizador: String(b.utilizador),
        modo: b.modo,
        percentagem: n(b.percentagem),
        deducao: n(b.deducao),
      })),
    }),
    [c],
  )
  const [v, setV] = useState(inicial)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const cp = usePersonalizados(ECRA_COMISSAO, comoRegistoCp(c))
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial) || cp.alterado)
  const mudar = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV((a) => ({ ...a, [k]: x }))
  const mudarLinha = (i: number, parcial: Partial<Linha>) =>
    mudar(
      'linhas',
      v.linhas.map((l, j) => (j === i ? { ...l, ...parcial } : l)),
    )
  const nosso = (l: Lado) => (l === 'angariacao' ? v.lado_angariacao_nosso : v.lado_venda_nosso)
  const pctVenda = v.pct_angariacao.trim() ? 100 - Number(v.pct_angariacao.replace(',', '.')) : null

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo: Record<string, unknown> = {
      versao: c.versao,
      pct_angariacao: dec(v.pct_angariacao),
      lado_angariacao_nosso: v.lado_angariacao_nosso,
      lado_venda_nosso: v.lado_venda_nosso,
      responsavel: Number(v.responsavel),
      observacoes: v.observacoes,
      beneficiarios: v.linhas
        .filter((l) => nosso(l.lado))
        .map((l) => ({
          lado: l.lado,
          utilizador: Number(l.utilizador),
          modo: l.modo,
          percentagem: l.modo === 'percentagem' ? dec(l.percentagem) : null,
          deducao: l.modo === 'deducao' ? dec(l.deducao) : null,
        })),
      campos_personalizados: cp.paraApi(),
    }
    // O valor só se indica à mão quando não há cálculo a partir do CMI (D-48 / Q13).
    if (c.valor_calculado === null) corpo.valor_final = dec(v.valor_final)
    try {
      const r = await comissoesApi.atualizar(c.id, corpo)
      guarda.libertar()
      qc.setQueryData(['comissoes', String(r.id)], r)
      qc.invalidateQueries({ queryKey: ['comissoes', 'lista'] })
      navegar(`/faturacao/comissoes/${r.id}`)
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos as Record<string, string[]>)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  function desenharCampo(k: string): ReactNode {
    switch (k) {
      case 'valor_final':
        return c.valor_calculado === null ? (
          <CampoTexto
            rotulo="Comissão total (€, sem IVA)"
            inputMode="decimal"
            value={v.valor_final}
            onChange={(e) => mudar('valor_final', e.target.value)}
            erro={erros.valor_final}
            ajuda="Não há cálculo a partir do CMI: indique o valor (vazio = por apurar; 0 = sem comissão)."
          />
        ) : (
          <CampoTexto
            rotulo="Comissão total (sem IVA)"
            value={formatarEuros(c.valor_final) ?? ''}
            disabled
            readOnly
            ajuda="Calculada a partir do CMI. Para a mudar, use «Pedir exceção ao valor» na ficha."
          />
        )
      case 'responsavel':
        return (
          <CampoResponsavel
            modulo="faturacao"
            valor={v.responsavel}
            atual={{ id: c.responsavel, nome: c.responsavel_nome }}
            aoMudar={(x) => mudar('responsavel', x)}
            erro={erros.responsavel}
          />
        )
      case 'pct_angariacao':
        return (
          <CampoTexto
            rotulo="% do lado da angariação"
            inputMode="decimal"
            value={v.pct_angariacao}
            onChange={(e) => mudar('pct_angariacao', e.target.value)}
            erro={erros.pct_angariacao}
            ajuda={pctVenda !== null ? `O lado da venda fica com ${pctVenda.toLocaleString('pt-PT')} %.` : undefined}
          />
        )
      case 'lados':
        return (
          <Largo>
            <div className="grelha-campos">
              <CampoCaixa
                rotulo="O lado da angariação é nosso (temos o imóvel)"
                checked={v.lado_angariacao_nosso}
                onChange={(e) => mudar('lado_angariacao_nosso', e.target.checked)}
              />
              <CampoCaixa
                rotulo="O lado da venda é nosso (temos o comprador)"
                checked={v.lado_venda_nosso}
                onChange={(e) => mudar('lado_venda_nosso', e.target.checked)}
              />
            </div>
          </Largo>
        )
      case 'beneficiarios':
        return (
          <Largo>
            <p className="ajuda">
              Em cada lado nosso, cada consultor recebe uma percentagem do lado ou o lado menos um valor fixo que fica
              para a agência. O resto fica para a agência.
            </p>
            {erros.beneficiarios && <p className="campo-erro">{erros.beneficiarios.join(' ')}</p>}
            <ul className="lista-proprietarios">
              {v.linhas.map((l, i) => (
                <li key={i} className={nosso(l.lado) ? '' : 'vazio'}>
                  <select
                    aria-label="Lado"
                    value={l.lado}
                    onChange={(e) => mudarLinha(i, { lado: e.target.value as Lado })}
                  >
                    {(['angariacao', 'venda'] as Lado[]).map((x) => (
                      <option key={x} value={x}>
                        {NOMES_LADO[x]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Consultor"
                    value={l.utilizador}
                    onChange={(e) => mudarLinha(i, { utilizador: e.target.value })}
                  >
                    {opcoes.data?.consultores.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nome}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Forma de cálculo"
                    value={l.modo}
                    onChange={(e) => mudarLinha(i, { modo: e.target.value as Linha['modo'] })}
                  >
                    <option value="">Forma de cálculo…</option>
                    {opcoes.data?.modos.map((x) => (
                      <option key={x.valor} value={x.valor}>
                        {x.nome}
                      </option>
                    ))}
                  </select>
                  {l.modo === 'percentagem' && (
                    <label className="quota">
                      % do lado
                      <input
                        inputMode="decimal"
                        value={l.percentagem}
                        onChange={(e) => mudarLinha(i, { percentagem: e.target.value })}
                      />
                    </label>
                  )}
                  {l.modo === 'deducao' && (
                    <label className="quota">
                      Fica para a agência (€)
                      <input
                        inputMode="decimal"
                        value={l.deducao}
                        onChange={(e) => mudarLinha(i, { deducao: e.target.value })}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className="botao-icone"
                    aria-label="Remover consultor"
                    onClick={() =>
                      mudar(
                        'linhas',
                        v.linhas.filter((_, j) => j !== i),
                      )
                    }
                  >
                    ✕
                  </button>
                  {!nosso(l.lado) && <small className="ajuda">Este lado não é nosso: a linha não será gravada.</small>}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="botao-secundario"
              disabled={!v.lado_angariacao_nosso && !v.lado_venda_nosso}
              onClick={() =>
                mudar('linhas', [
                  ...v.linhas,
                  {
                    lado: v.lado_angariacao_nosso ? 'angariacao' : 'venda',
                    utilizador: String(opcoes.data?.consultores[0]?.id ?? ''),
                    modo: '',
                    percentagem: '',
                    deducao: '',
                  },
                ])
              }
            >
              + Acrescentar consultor
            </button>
          </Largo>
        )
      case 'observacoes':
        return (
          <CampoAreaTexto
            rotulo="Observações"
            value={v.observacoes}
            onChange={(e) => mudar('observacoes', e.target.value)}
          />
        )
    }
    return null
  }

  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      <CabecalhoRegisto
        modulo="Faturação e Comissões"
        caminho="/faturacao"
        referencia={c.referencia}
        titulo={`Repartição da comissão · ${c.transacao_referencia}`}
      />
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}
      <BlocosConfiguraveis
        def={ECRA_COMISSAO}
        modo="editar"
        personalizados={cp}
        campo={desenharCampo}
        erros={erros}
        abertoInicial={(b) => b.chave !== 'observacoes' || !!v.observacoes}
      />
      <div className="barra-gravar">
        <button type="button" className="botao-secundario" onClick={() => navegar(`/faturacao/comissoes/${c.id}`)}>
          Cancelar
        </button>
        <button type="submit" className="botao-principal" disabled={aGravar}>
          {aGravar ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
      {guarda.dialogo}
    </form>
  )
}
