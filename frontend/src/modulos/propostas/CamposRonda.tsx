import { CampoAreaTexto, CampoSelecao, CampoTexto } from '../../componentes/campos'
import type { OpcoesProposta } from './api'
import type { ValoresRonda } from './ronda'

/** Valor e condições de uma ronda (proposta do comprador ou contraproposta do proprietário). */
export function CamposRonda({
  v,
  aoMudar,
  opcoes,
  erros,
}: {
  v: ValoresRonda
  aoMudar: (v: ValoresRonda) => void
  opcoes?: OpcoesProposta
  erros: Record<string, string[] | undefined>
}) {
  const m = (c: keyof ValoresRonda, x: string) => aoMudar({ ...v, [c]: x })
  const lista = (x?: { id: number; nome: string }[]) => (x ?? []).map((i) => ({ valor: i.id, nome: i.nome }))
  return (
    <>
      <div className="grelha-campos">
        <CampoSelecao
          rotulo="Quem propõe"
          value={v.autor}
          onChange={(e) => m('autor', e.target.value)}
          opcoes={opcoes?.autores ?? [{ valor: 'comprador', nome: 'Comprador' }]}
        />
        <CampoTexto
          rotulo="Valor (€)"
          required
          inputMode="decimal"
          value={v.valor}
          onChange={(e) => m('valor', e.target.value)}
          erro={erros.valor}
        />
        <CampoTexto
          rotulo="Sinal"
          inputMode="decimal"
          value={v.sinal_valor}
          onChange={(e) => m('sinal_valor', e.target.value)}
          erro={erros.sinal_valor}
        />
        <CampoSelecao
          rotulo="O sinal é em"
          value={v.sinal_unidade}
          onChange={(e) => m('sinal_unidade', e.target.value)}
          opcoes={opcoes?.unidades ?? []}
          erro={erros.sinal_unidade}
        />
        <CampoSelecao
          rotulo="Modo de pagamento"
          vazio="—"
          value={v.modo_pagamento}
          onChange={(e) => m('modo_pagamento', e.target.value)}
          opcoes={lista(opcoes?.modos_pagamento)}
        />
        <CampoSelecao
          rotulo="Depende de financiamento"
          vazio="—"
          value={v.financiamento}
          onChange={(e) => m('financiamento', e.target.value)}
          opcoes={lista(opcoes?.sim_nao)}
        />
        <CampoTexto
          rotulo="Data prevista do CPCV"
          type="date"
          value={v.data_cpcv}
          onChange={(e) => m('data_cpcv', e.target.value)}
          erro={erros.data_cpcv}
        />
        <CampoTexto
          rotulo="Data prevista da escritura"
          type="date"
          value={v.data_escritura}
          onChange={(e) => m('data_escritura', e.target.value)}
          erro={erros.data_escritura}
        />
        <CampoTexto
          rotulo="Válida até"
          type="date"
          value={v.validade}
          onChange={(e) => m('validade', e.target.value)}
          erro={erros.validade}
        />
      </div>
      <CampoAreaTexto
        rotulo="Condições especiais"
        value={v.condicoes}
        onChange={(e) => m('condicoes', e.target.value)}
      />
    </>
  )
}
