# Ambientes pessoal e trabalho

Este projeto pode operar em dois ambientes com o mesmo código, desde que dados e integrações fiquem separados.

## Modelo recomendado

- `main` local recebe as alterações.
- Dois remotes Git recebem o mesmo commit, por exemplo `pessoal` e `trabalho`.
- Cada repositório aciona seu próprio projeto Vercel.
- Cada Vercel usa seu próprio banco Postgres e seu próprio `JWT_SECRET`.
- Cada ambiente configura sua própria Planilha Google e Apps Script em **Integração Planilha**.

## Comandos base

```bash
git remote add pessoal https://github.com/seu-usuario/app-monitoramento.git
git remote add trabalho https://github.com/sua-organizacao/app-monitoramento.git

git push pessoal main
git push trabalho main
```

Se já existir `origin`, ele pode continuar apontando para o ambiente atual. Para publicar nos dois locais usando `origin` e `trabalho`:

```bash
git push origin main
git push trabalho main
```

## Variáveis por Vercel

Obrigatórias:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=um-segredo-grande-e-diferente-por-ambiente
NODE_ENV=production
```

Não configure `VITE_API_URL` na Vercel quando frontend e API estiverem no mesmo projeto. O frontend usa `/api`.

## Planilha por ambiente

1. Crie ou copie a Planilha Google do ambiente.
2. Implante o Apps Script como aplicativo da web na conta dona da planilha.
3. Entre no app do ambiente.
4. Abra **Integração Planilha**.
5. Salve o link da planilha e a URL do Apps Script.
6. Use **Testar conexão** antes de ativar a sincronização operacional.

## Usuários

O login público não cria contas. A criação é feita por administrador em **Usuários e Acessos**, gravando diretamente no banco do ambiente atual.

Ao criar um ambiente novo, entre com o acesso inicial documentado no `README.md`, crie o usuário administrador oficial e troque/desative credenciais temporárias conforme o fluxo operacional definido.
