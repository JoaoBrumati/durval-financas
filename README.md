# Fluxo | Gestão de crédito

Aplicação web para acompanhar empréstimos, clientes, parcelas e comprovantes.

## Recursos

- Dashboard mensal com capital emprestado, juros previstos, pessoas ativas e saldo a receber.
- Cadastro de clientes e contratos com parcelas calculadas automaticamente.
- Consulta por nome ou CPF, filtros de situação e acompanhamento individual.
- Baixa de parcelas, data de pagamento e anexo de comprovante de até 2 MB.
- Navegação lateral recolhível e layout adaptado para celular.

## Dados

Os contratos e parcelas são armazenados no PostgreSQL do Supabase. Os comprovantes ficam em um bucket privado do Supabase Storage; o navegador recebe apenas links assinados temporários para abri-los. O acesso exige uma conta Supabase e as políticas RLS vinculam todos os registros e arquivos ao usuário autenticado. O app usa o armazenamento local somente para a sessão de autenticação gerenciada pelo SDK; os dados financeiros não são persistidos no navegador.

Configure `.env.local` copiando `.env.example` e preenchendo a URL e a chave publicável (anon) do projeto Supabase. Aplique as migrations antes de iniciar o app:

```sh
supabase db push
```

Crie uma conta pela própria tela inicial. Se houver dados antigos em `localStorage`, o app os importa para a conta autenticada e só os remove do navegador depois que contratos, parcelas e comprovantes forem importados com sucesso.

## Manter o projeto Supabase ativo

A migration `supabase/migrations/20261026133800_supabase_keepalive.sql` configura, separadamente, uma rotina `pg_cron` que a cada três dias insere e apaga imediatamente um registro temporário em uma tabela exclusiva, sem tocar nos dados dos clientes.

Para ativá-la, aplique a migration ao projeto Supabase (`supabase db push`, com o projeto Supabase vinculado, ou execute o SQL pelo SQL Editor do painel). A extensão `pg_cron` precisa estar disponível no projeto. Depois, confirme no banco que o job `supabase-keepalive-every-three-days` aparece em `cron.job`; ele roda às 00:00 UTC nos dias 1, 4, 7 e assim por diante, com o intervalo podendo variar perto da virada do mês.

## Executar

```sh
npm install
npm run dev
```

Para validar a produção e o lint:

```sh
npm run build
npm run lint
```
