# Guia de Deploy - Sistema Salão de Beleza

## Deploy Rápido no Vercel

### 1. Preparar o Projeto

Certifique-se de que todas as configurações estão corretas:

```bash
# Verificar se o build funciona
npm run build

# Testar localmente
npm run dev
```

### 2. Deploy via Vercel CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Fazer login
vercel login

# Deploy
vercel
```

Siga as instruções:
- Escolha seu time (ou personal account)
- Confirme o nome do projeto
- O deploy será iniciado

### 3. Configurar Variáveis de Ambiente

No dashboard do Vercel ou via CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Cole sua URL do Supabase

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Cole sua chave anônima
```

### 4. Redesployar com as Variáveis

```bash
vercel --prod
```

## Deploy via GitHub

### 1. Criar Repositório

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/seu-usuario/salao-app.git
git push -u origin main
```

### 2. Conectar no Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em "New Project"
3. Importe seu repositório do GitHub
4. Configure as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Clique em "Deploy"

### 3. Deploy Automático

Agora, toda vez que você fizer push para main, o Vercel fará deploy automaticamente!

## Checklist Pré-Deploy

- [ ] Banco de dados Supabase criado e configurado
- [ ] Script SQL executado (supabase-setup.sql)
- [ ] Variáveis de ambiente configuradas
- [ ] Build testado localmente (`npm run build`)
- [ ] .env.local adicionado ao .gitignore (já está)

## Após o Deploy

### Obter URL do Projeto

Após o deploy, você receberá uma URL como:
```
https://salao-app.vercel.app
```

### Configurar Domínio Personalizado (Opcional)

No dashboard do Vercel:
1. Vá em Settings > Domains
2. Adicione seu domínio personalizado
3. Configure os registros DNS conforme instruções

## Troubleshooting

### Erro: supabaseUrl is required

As variáveis de ambiente não foram configuradas:
1. Verifique em Settings > Environment Variables
2. Adicione as duas variáveis necessárias
3. Faça um novo deploy

### Build falhando

Teste localmente primeiro:
```bash
npm run build
```

Se funcionar local mas não no Vercel:
- Verifique as versões do Node.js
- Confirme que todas as dependências estão no package.json
- Verifique logs de erro no dashboard

### Página em branco

1. Verifique console do navegador (F12)
2. Confirme que as variáveis de ambiente estão corretas
3. Teste a conexão com Supabase

## Comandos Úteis

```bash
# Ver logs do deploy
vercel logs

# Ver lista de deploys
vercel ls

# Ver domínios
vercel domains ls

# Remover projeto
vercel remove salao-app
```

## Custos

### Vercel (Hospedagem)
- Plano gratuito: Ilimitado para uso pessoal
- Limites: 100GB de largura de banda/mês

### Supabase (Banco de Dados)
- Plano gratuito: 500MB de banco, 2GB de armazenamento
- Limite de 50.000 usuários ativos mensais

## Backup

### Banco de Dados

No painel do Supabase:
1. Vá em Database > Backups
2. Backups automáticos diários (plano gratuito mantém 7 dias)

### Código

Sempre mantenha o código no GitHub:
```bash
git push origin main
```

## Monitoramento

### Analytics do Vercel

Acesse o dashboard para ver:
- Número de visitas
- Performance
- Erros

### Logs do Supabase

Acesse Database > Logs para monitorar:
- Queries lentas
- Erros de conexão
- Uso de recursos

## Próximos Passos

1. Configure autenticação (opcional)
2. Adicione notificações por email/SMS
3. Implemente backup automático de dados
4. Configure monitoramento de uptime
5. Adicione Google Analytics (opcional)
