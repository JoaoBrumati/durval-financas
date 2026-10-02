# Fluxo | Gestão de crédito

Aplicação local para acompanhar empréstimos, clientes, parcelas e comprovantes.

## Recursos

- Dashboard mensal com capital emprestado, juros previstos, pessoas ativas e saldo a receber.
- Cadastro de clientes e contratos com parcelas calculadas automaticamente.
- Consulta por nome ou CPF, filtros de situação e acompanhamento individual.
- Baixa de parcelas, data de pagamento e anexo de comprovante de até 2 MB.
- Navegação lateral recolhível e layout adaptado para celular.

## Dados

A carteira inicia vazia. Os novos contratos e comprovantes ficam no armazenamento local do navegador deste dispositivo; não há servidor ou sincronização entre dispositivos. CPF e comprovantes são informações sensíveis, então use o aplicativo apenas em um dispositivo protegido.

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
