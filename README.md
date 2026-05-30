# Monitoramento Diário de Câmeras de Barcos

Sistema web para substituir a planilha de checagem diária de câmeras de barcos offshore nos horários 10:00, 13:00 e 16:00.

## Tecnologias

- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express
- Banco: SQLite
- Autenticação: JWT
- Gráficos: Recharts
- Exportação: CSV e Excel
- Integração de status com Google Sheets via Apps Script
- Controle de estoque de equipamentos de TI
- Estrutura mantida para futura integração Microsoft Graph / Excel

## Instalação

```bash
cp .env.example backend/.env
cp .env.example frontend/.env
npm install
npm run install:all
```

## Rodar o backend

```bash
npm run dev --prefix backend
```

API em `http://localhost:4000/api`.

## Rodar o frontend

```bash
npm run dev --prefix frontend
```

Interface em `http://localhost:5173`.

## Rodar tudo junto

```bash
npm run dev
```

## Deploy na Vercel com banco externo

Para hospedar grátis na Vercel, use um Postgres externo gratuito como Neon ou Supabase.

Variáveis na Vercel:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=um-segredo-grande
NODE_ENV=production
```

Não defina `VITE_API_URL` na Vercel. O frontend usa `/api` no mesmo domínio.

Build settings:

```bash
Install Command: npm install && npm run install:all
Build Command: npm run build
Output Directory: frontend/dist
```

O arquivo `vercel.json` já direciona `/api/*` para o backend Express serverless e as demais rotas para o React.

## Acesso inicial

- Usuário: `rsferraz`
- Senha: `123@Mudar`

## Fluxo de usuários

Novas contas são criadas por um administrador dentro do sistema, em **Usuários e Acessos**. O login público não cria ou solicita contas.

Cada ambiente grava seus próprios usuários no banco configurado em `DATABASE_URL`. Ao migrar para outro Vercel/banco, crie o primeiro acesso com o login inicial e depois cadastre os usuários oficiais pela tela administrativa.

## Ambientes em paralelo

É possível manter o mesmo código em dois repositórios/remotes e publicar em dois projetos Vercel diferentes. O ponto importante é separar dados e integrações:

- Código: pode ser o mesmo commit nos dois Git remotes.
- Vercel pessoal e Vercel trabalho: cada um com suas próprias variáveis de ambiente.
- Banco: cada ambiente deve ter seu próprio `DATABASE_URL`, salvo decisão explícita de compartilhar dados.
- Planilha: cada ambiente deve configurar sua própria Planilha Google e URL do Apps Script na aba **Integração Planilha**.

Exemplo de remotes locais:

```bash
git remote add pessoal https://github.com/seu-usuario/repositorio-pessoal.git
git remote add trabalho https://github.com/organizacao/repositorio-trabalho.git
git push pessoal main
git push trabalho main
```

Se os dois projetos Vercel estiverem ligados aos respectivos repositórios, cada push publica o ambiente correspondente.

## Resetar banco

```bash
npm run reset:db
```

O reset remove o arquivo SQLite local e recria tabelas, usuário administrador, grupos e câmeras iniciais.

## Integração Google Sheets

A aba **Integração Planilha** permite salvar:

- Link da Planilha Google
- URL publicada do Apps Script
- Ativar/desativar atualização automática
- Testar conexão
- Enviar registros já salvos

Quando a integração está ativa, o botão **Salvar** do dashboard envia os registros para a aba `Base_App` da Planilha Google. As colunas esperadas são:

```txt
Data	ID	Nome da Camera	Grupo	Horario	Status	Observacao	Comportamento	Responsavel	AtualizadoEm
```

O Apps Script deve estar implantado como aplicativo da web executando como o proprietário da planilha e acessível a qualquer pessoa com a URL.

## Estoque de TI

A aba **Estoque de TI** cadastra equipamentos recebidos, como kits de mouse e teclado e celulares por modelo. Cada item registra categoria, equipamento, modelo, quantidade, data de recebimento e observação, com edição posterior para ajustes de quantidade.

## Modelo Excel e integração futura Microsoft

O sistema já está mapeado para a planilha `PLANILHAFINAL.xlsx`, copiada em `backend/templates/`.

Mapeamento preparado:

- Abas mensais: `Janeiro` a `Dezembro`
- Linha de cabeçalho: `5`
- Dados a partir da linha: `6`
- Colunas: `Data`, `Dia`, `ID`, `Nome da Câmera`, `Embarcação/Local`, `10:00`, `13:00`, `16:00`, `Evento Técnico Online/Offline`, `Comportamento do Colaborador`, `Responsável`
- Aba de ocorrências: `Ocorrências`
- Status do sistema para a planilha: `Online`, `Offline`, `Manutenção`; `Sem acesso` é enviado como `Não verificado` e preservado no evento técnico quando aplicável.
- Câmeras cadastradas no padrão da planilha: `CAM 01` a `CAM 23`, sendo 13 ativas e 10 futuras/inativas.
- Alterações de nome feitas no cadastro são preparadas para atualizar a aba `Configurações` e as abas mensais na sincronização Excel.

Enquanto a integração Microsoft Graph não estiver ativada, o backend escreve diretamente na planilha local `PLANILHAFINAL.xlsx`. Por padrão ele usa:

```bash
/Users/rodolfoferraz/Downloads/PLANILHAFINAL.xlsx
```

Para apontar para outro arquivo local, defina no `backend/.env`:

```bash
EXCEL_LOCAL_FILE=/caminho/para/PLANILHAFINAL.xlsx
```

Na hospedagem Vercel, arquivo local não é persistente nem abre como planilha de trabalho. O fluxo ativo de atualização online usa Google Sheets.

Hoje os botões usam um mock controlado em `backend/src/services/graphExcelService.js`. Para ativar a integração real:

1. Registre um aplicativo no Microsoft Entra ID.
2. Configure permissões Microsoft Graph para ler e alterar workbooks no OneDrive/SharePoint.
3. Adicione variáveis como `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`.
4. Substitua os métodos `testConnection` e `syncChecks` pelo uso real do Microsoft Graph Excel API.
5. Use o mapeamento em `backend/src/services/excelTemplate.js` para atualizar as células certas via Graph.
6. Mantenha a tabela `excel_settings` como fonte das configurações salvas pelo usuário.

## Scripts úteis

```bash
npm run build --prefix frontend
npm run seed --prefix backend
npm run reset:db --prefix backend
```
