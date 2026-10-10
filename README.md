# Rastreio do produto enviado ao criador

Integração com um agregador de rastreio fictício: registra o código, consulta o status e traduz o dialeto da transportadora para um conjunto pequeno e estável. Avisa quando o tempo em trânsito passa de um limite configurável.

## Conjunto estável

`postado`, `em_transito`, `saiu_para_entrega`, `entregue`, `excecao`. A tradução está em `normalizeStatus` (`src/status.ts`). Um status que a transportadora inventou cai em `excecao` — nunca vira `entregue`.

## Regras

- **Não regride.** O status atual é o de maior progresso; `entregue` é terminal. Um evento antigo que chega atrasado (fora de ordem) não faz o status voltar. Uma exceção só é o status atual quando é o evento mais recente por data.
- **Idempotente.** Consultar o mesmo código de novo não duplica o histórico (dedupe por id do evento, ou por status + data).
- **Atraso configurável.** `late` é verdadeiro quando o tempo em trânsito (`entregue` menos `postado`, ou agora menos `postado` se ainda não entregou) passa de `maxTransitMs`. Uma entrega normal dentro do limite não é marcada como atraso. Testado com data controlada.

## Fronteira

`TrackingAggregator` (`src/aggregator.ts`) é a interface. `FakeTrackingAggregator` implementa ela e os testes trocam por outro agregador sem tocar na regra de negócio: o formato bruto da transportadora é normalizado na borda e não vaza para o resto do código.

Payload bruto: `{ "id": "e2", "status": "OUT_FOR_DELIVERY", "occurredAt": "2026-06-03T10:00:00.000Z" }` → normalizado: `saiu_para_entrega`.

## Como rodar

Node 22.

```bash
npm install
npm test
npm run dev   # http://127.0.0.1:3007
```

```bash
curl -s -X POST localhost:3007/shipments/BR123/track
curl -s localhost:3007/shipments/BR123
```

## Uso de IA

Usei o Claude para criar os testes.
