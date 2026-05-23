# Monitoramento Diário de Câmeras de Barcos

Sistema web para substituir a planilha de checagem diária de câmeras de barcos offshore nos horários 10:00, 13:00 e 16:00.

## Tecnologias

- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express
- Banco: SQLite
- Autenticação: JWT
- Gráficos: Recharts
- Exportação: CSV e Excel
- Preparado para Microsoft Graph API / Excel no OneDrive ou SharePoint

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

- Usuário: `admin`
- Senha: `Baru123@Mudar`

## Resetar banco

```bash
npm run reset:db
```

O reset remove o arquivo SQLite local e recria tabelas, usuário admin, barcos e 13 câmeras iniciais.

## Integração futura com Excel / OneDrive / SharePoint

A aba **Integração Excel** já permite salvar:

- Link do arquivo Excel no OneDrive/SharePoint
- Nome da aba da planilha
- Ativar/desativar integração
- Testar conexão
- Sincronizar dados
- Sincronizar planilha local

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
