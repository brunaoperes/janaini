# Guia Rápido de Início

## Começar em 5 Minutos

### 1. Configure o Supabase (2 minutos)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto (escolha nome e senha)
3. Aguarde a criação (1-2 minutos)
4. Vá em "SQL Editor"
5. Copie e cole TODO o conteúdo do arquivo `supabase-setup.sql`
6. Clique em "Run"

### 2. Configure as Variáveis (1 minuto)

1. No Supabase, vá em Settings > API
2. Copie a **Project URL** e a **anon public**
3. Abra o arquivo `.env.local` (se não existir, crie)
4. Cole:

```
NEXT_PUBLIC_SUPABASE_URL=cole_a_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole_a_chave_aqui
```

### 3. Instale e Execute (2 minutos)

```bash
# Instalar dependências
npm install

# Executar
npm run dev
```

Pronto! Acesse: http://localhost:3000

## Primeiro Uso

### 1. Cadastrar Colaboradoras

1. Clique em "Administração"
2. Clique em "Colaboradores"
3. Clique em "+ Novo Colaborador"
4. Preencha nome e porcentagem de comissão
5. Salve

### 2. Cadastrar Clientes

1. Em "Administração", clique em "Clientes"
2. Cadastre algumas clientes de teste

### 3. Testar o Fluxo

1. Volte à página inicial
2. Clique em "Colaboradores"
3. Escolha uma colaboradora
4. Crie um agendamento
5. Finalize o atendimento

## Estrutura de Navegação

```
Página Inicial
├── Colaboradores (acesso rápido para cada colaboradora)
│   └── [Nome da Colaboradora]
│       ├── Minha Agenda
│       ├── Novo Agendamento
│       └── Finalizar Atendimento
├── Administração
│   ├── Clientes (CRUD completo)
│   ├── Colaboradores (CRUD completo)
│   ├── Relatórios (financeiro)
│   └── Agenda Geral
└── Agenda Geral (visualização em grade)
```

## Fluxo da Colaboradora

```
1. Entrar → Clicar no próprio nome
2. Ver agenda do dia
3. Criar agendamento:
   - Buscar cliente pelo nome
   - Escolher horário
   - Descrever serviço
4. Finalizar atendimento:
   - Clicar em "Finalizar"
   - Informar valor e forma de pagamento
   - Sistema calcula comissões automaticamente
```

## Dados de Exemplo

O script SQL já cria dados de exemplo:

**Colaboradoras:**
- Maria Silva (50%)
- Ana Costa (45%)
- Juliana Santos (50%)

**Clientes:**
- Carla Souza
- Beatriz Lima
- Fernanda Oliveira

## Próximos Passos

1. Cadastre suas colaboradoras reais
2. Cadastre suas clientes
3. Delete os dados de exemplo (se desejar)
4. Configure para produção (veja DEPLOY.md)

## Precisa de Ajuda?

Veja a documentação completa em `README.md`
