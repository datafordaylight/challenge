# Data for Daylight Challenge

Projeto paralelo e independente para rodar no GitHub Pages.

## Créditos e referência

Este projeto é um tracker independente inspirado pelo [DBD Survivor Gauntlet](https://mayursoneji.com/projects/dbd-survivor-gauntlet/) e pelo app público [DBD Challenges](https://dbd-challenges.mayursoneji.com/), criados por Mayur Soneji. Não é uma cópia oficial, não usa login, não usa backend e não possui vínculo com Mayur Soneji, Behaviour Interactive ou Dead by Daylight.

Os créditos aparecem no rodapé e na página `#help`.

## Características

- Sem login.
- Sem backend.
- Progresso salvo no navegador com `localStorage`.
- Exportação/importação por JSON.
- Modo Sobreviventes e modo Assassinos, com progresso separado.
- Sorteio entre personagens restantes.
- Checkpoint configurável e rollback em caso de falha.
- Idioma detectado automaticamente pelo navegador.
- i18n iniciado em `pt-BR` e `en`, expansível em `assets/app.js`.
- Painel de controle separado com menu próprio.
- Telas separadas por navegação: `#tracker`, `#panel` e `#help`.
- Tela inicial de escolha de caminho, inspirada no fluxo do projeto original.
- Tracker em layout de trial com barra de progresso, checkpoint, seleção atual e grid compacto.
- Modal `Challenge Statistics` com progresso, partidas, win rate, falhas, sequências e melhor/pior entrada.
- Gerenciamento por entrada: concluir, desfazer, pular, reativar, bloquear/desbloquear e priorizar.
- Histórico editável com remoção de eventos específicos.
- Regras locais: checkpoint, pool de sorteio, auto-sorteio, visibilidade de concluídos e notas.
- Página de ajuda com explicação detalhada do fluxo, checkpoints, entradas específicas, regras e backup.

## Publicação

Publique a pasta inteira como site estático no GitHub Pages. Não há etapa de build.

## Prévia local

Abra `index.html` diretamente no navegador ou sirva a pasta com qualquer servidor estático.

## Bugs

Reporte problemas em https://github.com/datafordaylight/challenge/issues.
