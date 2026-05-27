# Baru Offshore - Contexto de Continuidade

Leia este arquivo antes de analisar ou alterar o projeto. Ele registra as decisoes validadas com o usuario e evita regressao para solucoes antigas.

## Produto Atual

- Sistema de monitoramento diario de cameras embarcadas da Baru Offshore.
- URL publicada: `https://app-monitoramento.vercel.app`.
- Stack: React/Vite/Tailwind no frontend, Node/Express no backend, Postgres Neon em producao e SQLite apenas para desenvolvimento local.
- Deploy: Vercel ligado ao repositorio GitHub; push na branch `main` dispara publicacao.
- Autenticacao JWT; existe fluxo de solicitacao de conta e aprovacao pelo administrador.
- Nao registrar credenciais, tokens, URLs privadas de webhook ou connection strings no repositorio.

## Escopo Operacional Validado

- Existem 60 cameras distribuidas nos grupos cadastrados em `backend/src/db/cameraCatalog.js`.
- Horarios fixos: `10:00`, `13:00` e `16:00`.
- Uso operacional principal: marcar `Offline` manualmente e aplicar `restantes online` em lote.
- O Dashboard tambem oferece copia de status entre horarios: `10:00 -> 13:00`, `10:00 -> 16:00` e `13:00 -> 16:00`.
- Acao em lote afeta o grupo exibido; selecionando `Todos os grupos`, afeta todas as cameras.
- Copia de horario copia status, nao observacoes nem nota de comportamento.
- Dados de testes foram zerados no banco de producao em 24/05/2026; a operacao real deve iniciar limpa.

## Interface e Direcao Visual

- Identidade: Baru Offshore, tema claro e corporativo.
- Login usa logomarca e imagem da embarcacao fornecidas pelo usuario.
- Manter interface enxuta e executiva, sem textos instrucionais excessivos.
- O bloco de acoes rapidas do Dashboard foi refinado para duas linhas alinhadas; nao reintroduzir botoes desalinhados ou altos.
- Aba `Cameras` permanece aberta no menu, mas sem configuracao de streaming ate decisao futura do usuario.

## Fonte de Dados e Analitico

- A fonte oficial do app e o banco Postgres em producao; a planilha recebe sincronizacao dos registros salvos.
- A aba `Analitico` consulta a tabela `checks` pela API e portanto acompanha os status efetivamente salvos no app.
- `Analitico` possui exportacao `PDF executivo`, usando a pagina com cards e graficos.
- Nos cards de `Analitico`, cada camera conta uma vez pelo ultimo status no periodo filtrado; graficos continuam analisando registros por horario.
- O grafico de disponibilidade do `Analitico` usa a nomenclatura `grupo` e deve preservar nomes completos legiveis.
- O grafico de problemas por camera identifica grupo e camera, sem consolidar cameras diferentes que tenham o mesmo nome.
- O grafico mensal do `Analitico` apresenta percentuais de status; quantidades sao verificacoes por horario e aparecem apenas como detalhamento.
- O `Analitico` usa apresentacao executiva com cabecalho escuro, filtros agrupados, indicadores destacados e paineis de graficos padronizados.
- `Relatorios` exporta CSV e Excel; o Excel tem `Resumo Executivo` e `Registros` formatados.
- Ao alterar regras de status, manter consistencia entre Dashboard, API, Analitico, relatorios e sincronizacao da planilha.

## Integracao de Planilha Ativa

- O caminho ativo em producao e Google Sheets via Google Apps Script, nao Microsoft Graph nem Excel/OneDrive.
- A tela continua na rota `/excel`, com rotulo de menu `Integracao Planilha`.
- Configuracao e persistida em `excel_settings`, incluindo `google_sheet_url`, `google_webhook_url` e `enabled`.
- O link da Planilha Google e a URL do Apps Script ficam configurados no banco/ambiente operacional; nao hardcode nem exponha no Git.
- Ao salvar verificacoes no Dashboard, o backend envia os registros para o Apps Script usando `backend/src/services/googleSheetsService.js`.
- O envio e agrupado por data para que registros de dias ou meses diferentes sejam roteados corretamente.

## Estrutura Atual da Planilha Google

- `Base_App`: historico completo sincronizado.
- `App_Janeiro` a `App_Dezembro`: abas operacionais mensais criadas pelo Apps Script.
- As abas mensais antigas do arquivo original foram removidas pelo usuario para eliminar formulas quebradas e conflito com celulas mescladas.
- Preservar abas de apoio como `Dashboard BI`, `Configuracoes` e `Ocorrencias`, quando existentes.
- O Apps Script pertence a conta Google do usuario e nao fica neste repositorio. Se for necessario altera-lo, pedir o codigo atual antes de devolver uma versao completa para colagem e nova implantacao.

## BI da Planilha

- O `Dashboard BI` original apresentou `#REF!` depois da troca das abas antigas para `App_*`.
- Foi fornecida ao usuario uma funcao Apps Script para zerar dados de teste e reconstruir formulas do BI a partir de `Base_App`.
- Antes de modificar o BI novamente, confirmar visualmente com o usuario se ainda existe algum erro na planilha.
- O BI no Google Sheets e secundario ao Analitico do app; nao alterar dados reais no banco para tentar corrigir somente uma formula da planilha.

## Funcionalidades Implementadas Importantes

- Login padrao inicial documentado no `README.md`; preferir troca de senha pelo fluxo do sistema.
- Solicitacao de conta pelo login e aprovacao/rejeicao administrativa em `Usuarios e Acessos`.
- E-mail de aviso de nova solicitacao opcional via Resend.
- Cadastro e ativacao/desativacao de grupos/cameras.
- Dashboard por data e grupo, rastreabilidade de usuario e data de edicao.
- Acoes rapidas de status.
- Analitico com graficos Recharts e exportacao visual para PDF.
- Relatorios CSV/XLSX executivos.
- Integracao Google Sheets ativa.
- Estoque de TI para cadastro de equipamentos recebidos, modelos e quantidades.
- Preparacao antiga para Excel/Microsoft Graph pode permanecer apenas como compatibilidade futura, sem ser apresentada como fluxo ativo.

## Regras de Manutencao

- Antes de editar, verificar o estado atual do app publicado e ler os arquivos relacionados.
- Nao substituir a integracao Google Sheets por OneDrive/Graph sem pedido explicito.
- Nao restaurar nomes genericos de cameras nem codigos internos visiveis na interface.
- Nao apagar registros reais de producao sem confirmacao explicita do usuario.
- Para testes de sincronizacao em producao, usar dados claramente identificados e limpar/restaurar o estado imediatamente.
- Validar build antes de push: `npm run build`.
- Apos push, confirmar que a Vercel publicou a nova versao antes de declarar a mudanca disponivel.

## Inicio Rapido Para Uma Nova Sessao

1. Leia este arquivo e o `README.md`.
2. Rode `git status --short` e `git log --oneline -5`.
3. Se o pedido envolver producao, confirme primeiro o comportamento na URL publicada.
4. Se envolver Google Sheets/Apps Script, lembre que o script externo nao esta no repo; solicite o codigo atual quando necessario.
5. Preserve o fluxo atual: app salva no banco, sincroniza para Google Sheets e apresenta dados no Analitico/relatorios.
